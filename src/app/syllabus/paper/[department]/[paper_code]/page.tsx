import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Syllabus } from "@/types";
import { toSyllabus } from "@/types";
import MainLayout from "@/components/layout/MainLayout";
import VerifyStrip from "@/components/VerifyStrip";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import {
  dedupeSyllabusRowsByUnit,
  derivePaperNameFromContent,
  normalizePaperCode,
  semesterForPaperCode,
  toSyllabusTableRow,
} from "@/lib/syllabus-table";
import {
  SYLLABUS_DEPARTMENTS,
  syllabusDeptBySubjectCode,
  syllabusDeptSlugForPaperCode,
} from "@/lib/syllabus-departments";

const SITE_URL = "https://www.examarchive.dev";

interface PageProps {
  params: Promise<{ department: string; paper_code: string }>;
}

const UNKNOWN_YEAR_LABEL = "Unknown year";
const UNKNOWN_UNIVERSITY_LABEL = "Unknown university";
const MAX_QUESTIONS_PER_PAPER = 500;

/** Tags that are internal pipeline metadata, not meant for display. */
const HIDDEN_TAG_PREFIXES = ["watermark:", "personalization:", "internal:", "debug:"];

function isDisplayTag(tag: string): boolean {
  const t = tag.trim().toLowerCase();
  if (!t) return false;
  return !HIDDEN_TAG_PREFIXES.some((p) => t.startsWith(p)) && !t.includes(":");
}

/**
 * Splits a unit's prose content into bullet points on sentence boundaries.
 * Falls back to a single bullet when no clean split is found.
 */
function splitIntoBullets(content: string): string[] {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return [];
  // Split on ". " / "! " / "? " followed by a capital letter or digit,
  // keeping common abbreviations intact.
  const parts = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  if (parts.length <= 1) return [text];
  return parts;
}

type LinkedQuestionRow = {
  id: string;
  question_no: string;
  question_subpart: string;
  year?: number;
  marks?: number;
  question_content: string;
  tags: string[];
  linked_syllabus_entry_id?: string;
  link_status?: string;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { department, paper_code } = await params;
  const info = SYLLABUS_DEPARTMENTS[department];
  if (!info) return { title: "Not Found" };
  const code = decodeURIComponent(paper_code).toUpperCase();
  const title = `${code} Syllabus | Assam University ${info.name}`;
  const description = `Unit-wise ${info.name} syllabus for ${code} — Assam University FYUG, Haflong Government College. Free to browse, PDF download available.`;
  return {
    title,
    description,
    keywords: [`${code} syllabus`, `Assam University ${info.name} syllabus`, `${code} FYUG syllabus`],
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/syllabus/paper/${department}/${code}`,
      type: "website",
    },
    alternates: { canonical: `/syllabus/paper/${department}/${code}` },
  };
}

/**
 * All syllabus-table rows for one paper. Rows are matched by canonical code
 * ("PHYSEC-101" and "PHYSEC101" are the same paper), so a paper stored under
 * several spellings returns every variant's rows. Fetches the whole subject
 * (one department's rows fit in a single 500-row page) because Appwrite has
 * no "normalised code" field to query. Falls back to the exact-code query
 * when the subject fetch finds nothing (defensive: rows whose subject field
 * disagrees with the URL department still resolve).
 */
async function getPaperRows(paperCode: string, subjectCode: string) {
  const db = adminDatabases();
  const wanted = normalizePaperCode(paperCode);
  const rows: ReturnType<typeof toSyllabusTableRow>[] = [];
  let offset = 0;
  for (;;) {
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus_table,
      [
        Query.equal("status", "published"),
        Query.equal("subject", subjectCode),
        Query.limit(500),
        Query.offset(offset),
      ],
    );
    for (const doc of documents) {
      const row = toSyllabusTableRow(doc as Record<string, unknown>);
      if (normalizePaperCode(row.paper_code) === wanted) rows.push(row);
    }
    if (documents.length < 500) break;
    offset += 500;
  }
  if (rows.length > 0) {
    return rows.sort((a, b) => a.unit_number - b.unit_number);
  }
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.syllabus_table,
    [Query.equal("paper_code", paperCode), Query.limit(200)],
  );
  return documents
    .map((doc) => toSyllabusTableRow(doc as Record<string, unknown>))
    .sort((a, b) => a.unit_number - b.unit_number);
}

async function getUploadedSyllabusPdfs(paperCode: string): Promise<Syllabus[]> {
  const db = adminDatabases();
  const byCourseCode = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.syllabus,
    [Query.equal("approval_status", "approved"), Query.equal("course_code", paperCode), Query.limit(50)],
  );
  if (byCourseCode.documents.length > 0) {
    return byCourseCode.documents.map(toSyllabus).filter((s) => !s.is_hidden);
  }

  const syllabusSeed = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.syllabus_table,
    [Query.equal("paper_code", paperCode), Query.limit(1)],
  );
  const derivedPaperName =
    typeof syllabusSeed.documents[0]?.syllabus_content === "string"
      ? derivePaperNameFromContent(syllabusSeed.documents[0].syllabus_content, "")
      : "";

  const questionSeed = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.questions_table,
    [Query.equal("paper_code", paperCode), Query.limit(1)],
  );
  const questionPaperName =
    typeof questionSeed.documents[0]?.paper_name === "string"
      ? questionSeed.documents[0].paper_name.trim()
      : "";
  const paperName = questionPaperName || derivedPaperName || paperCode;

  const bySubject = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.syllabus,
    [Query.equal("approval_status", "approved"), Query.equal("subject", paperName), Query.limit(50)],
  );
  return bySubject.documents.map(toSyllabus).filter((s) => !s.is_hidden);
}

function sortLinkedQuestions(a: LinkedQuestionRow, b: LinkedQuestionRow): number {
  const aNo = Number(a.question_no);
  const bNo = Number(b.question_no);
  if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
  if (a.question_no !== b.question_no) return a.question_no.localeCompare(b.question_no);
  if (a.question_subpart !== b.question_subpart) return a.question_subpart.localeCompare(b.question_subpart);
  return (b.year ?? 0) - (a.year ?? 0);
}

async function getLinkedQuestionRows(paperCodes: string[], linkedSyllabusIds: Set<string>) {
  const db = adminDatabases();
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.questions_table,
    // One query for every raw spelling of the code: questions may be stored
    // under "PHYDSC453(A)T" while the page URL is the canonical "PHYDSC453AT".
    [Query.equal("paper_code", paperCodes), Query.limit(MAX_QUESTIONS_PER_PAPER)],
  );

  const allRows: LinkedQuestionRow[] = documents.map((doc) => ({
    id: String(doc.$id ?? ""),
    question_no: String(doc.question_no ?? ""),
    question_subpart: String(doc.question_subpart ?? ""),
    year: typeof doc.year === "number" ? doc.year : undefined,
    marks: typeof doc.marks === "number" ? doc.marks : undefined,
    question_content: String(doc.question_content ?? ""),
    tags: Array.isArray(doc.tags) ? doc.tags.filter((tag): tag is string => typeof tag === "string") : [],
    linked_syllabus_entry_id:
      typeof doc.linked_syllabus_entry_id === "string" && doc.linked_syllabus_entry_id.trim().length > 0
        ? doc.linked_syllabus_entry_id.trim()
        : undefined,
    link_status: typeof doc.link_status === "string" ? doc.link_status : undefined,
  }));

  const linkedRows = allRows.filter(
    (row) => row.linked_syllabus_entry_id && linkedSyllabusIds.has(row.linked_syllabus_entry_id),
  );
  const usedFallbackToAll = linkedRows.length === 0;
  const rowsToShow = (usedFallbackToAll ? allRows : linkedRows).sort(sortLinkedQuestions);
  const filteredOutCount = linkedRows.length > 0 ? allRows.length - linkedRows.length : 0;
  return { rowsToShow, filteredOutCount, usedFallbackToAll };
}

export default async function SyllabusPaperPage({ params }: PageProps) {
  const { department, paper_code } = await params;
  const info = SYLLABUS_DEPARTMENTS[department];
  if (!info) notFound();
  const code = decodeURIComponent(paper_code).toUpperCase();
  const canonicalCode = normalizePaperCode(code);
  const semester = semesterForPaperCode(canonicalCode);
  // One canonical URL per paper: a hyphenated or parenthesised spelling in
  // the URL ("PHYSEC-101", "PHYDSC453(A)T") redirects to the canonical code
  // before any slow database call, so the redirect is a real HTTP 308.
  if (code !== canonicalCode) {
    permanentRedirect(`/syllabus/paper/${department}/${canonicalCode}`);
  }
  // Wrong department in the URL: redirect before any slow database call,
  // so the redirect is a real HTTP 308 instead of a client-side one.
  const prefixSlug = syllabusDeptSlugForPaperCode(code);
  if (prefixSlug && prefixSlug !== department) {
    permanentRedirect(`/syllabus/paper/${prefixSlug}/${code}`);
  }
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  const [allRows, uploadedPdfs] = await Promise.all([
    getPaperRows(code, info.subjectCode),
    getUploadedSyllabusPdfs(code),
  ]);

  if (allRows.length === 0) {
    notFound();
  }

  // Display one article per unit: rows stored under several raw spellings
  // of the same code collapse to a single representative row each.
  const rows = dedupeSyllabusRowsByUnit(allRows);

  // One canonical URL per paper: a paper visited under the wrong department
  // permanently redirects to its own department (subject field is ground truth).
  const paperDept = syllabusDeptBySubjectCode(allRows[0]?.subject ?? "");
  if (paperDept && paperDept.slug !== department) {
    permanentRedirect(`/syllabus/paper/${paperDept.slug}/${code}`);
  }

  const first = rows[0];
  const paperName = first.paper_name?.trim() || derivePaperNameFromContent(first.syllabus_content, code);
  // Entry IDs and raw code spellings from ALL matched rows (both variants),
  // so questions linked to either spelling are found.
  const linkedSyllabusIds = new Set(
    allRows.flatMap((row) => [row.entry_id, row.id]).filter((entryId): entryId is string => {
      if (typeof entryId !== "string") return false;
      return entryId.trim().length > 0;
    }),
  );
  const rawCodes = [...new Set(allRows.map((row) => row.paper_code.trim().toUpperCase()))].filter(
    (c) => c.length > 0,
  );
  const { rowsToShow: linkedQuestions, filteredOutCount, usedFallbackToAll } = await getLinkedQuestionRows(rawCodes.length > 0 ? rawCodes : [code], linkedSyllabusIds);

  return (
    <MainLayout
      title={`${code} Syllabus`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Syllabus", href: "/syllabus" },
        { label: info.name, href: `/syllabus/${department}` },
        ...(semester > 0
          ? [{ label: `Semester ${semester}`, href: `/syllabus/${department}#semester-${semester}` }]
          : []),
        { label: code },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
        <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Syllabus_Table Source
          </p>
          <h1 className="mt-2 text-3xl font-black text-on-surface break-words">{paperName}</h1>
          <p className="mt-1 font-mono text-sm text-on-surface-variant break-words">{code}</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {first.university} · {first.course} · {first.stream} · {first.type}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`/api/syllabus/table?paperCode=${encodeURIComponent(code)}&mode=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              Download Syllabus PDF
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {rows.map((row) => {
              const bullets = splitIntoBullets(row.syllabus_content);
              const displayTags = row.tags.filter(isDisplayTag);
              return (
              <article
                key={row.id}
                className="rounded-2xl border border-outline-variant/40 bg-surface p-4 overflow-hidden"
              >
                <h2 className="text-lg font-semibold text-on-surface break-words">Unit {row.unit_number}</h2>
                {typeof row.lectures === "number" && (
                  <p className="mt-1 text-xs text-on-surface-variant">Lectures: {row.lectures}</p>
                )}
                {bullets.length > 1 ? (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-on-surface-variant">
                    {bullets.map((b, i) => (
                      <li key={i} className="break-words leading-relaxed">{b}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-on-surface-variant break-words leading-relaxed">
                    {row.syllabus_content}
                  </p>
                )}
                {displayTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {displayTags.map((tag) => (
                      <span
                        key={`${row.id}-${tag}`}
                        className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <VerifyStrip
                  contentType="syllabus"
                  contentId={`syllabus:${paper_code}:unit:${row.unit_number}`}
                />
              </article>
              );
            })}

            <article className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
              <h2 className="text-lg font-semibold text-on-surface">Linked Questions</h2>
              {linkedQuestions.length === 0 ? (
                <p className="mt-2 text-sm text-on-surface-variant">No questions linked to this syllabus yet.</p>
              ) : (
                <>
                  {usedFallbackToAll && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Showing all paper questions because no linked question rows were found for this syllabus.
                    </p>
                  )}
                  {filteredOutCount > 0 && (
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Showing {linkedQuestions.length} linked questions ({filteredOutCount} other paper questions hidden).
                    </p>
                  )}
                  <div className="mt-3 space-y-3">
                    {linkedQuestions.map((question) => (
                      <div key={question.id} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                        <p className="text-xs font-semibold text-on-surface-variant">
                          Q{question.question_no}
                          {question.question_subpart ? `(${question.question_subpart})` : ""}
                          {typeof question.year === "number" ? ` · ${question.year}` : ""}
                          {typeof question.marks === "number" ? ` · ${question.marks} marks` : ""}
                        </p>
                        <p className="mt-1 text-sm text-on-surface">{question.question_content}</p>
                        {(question.tags.length > 0 || question.link_status) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {question.link_status && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                {question.link_status}
                              </span>
                            )}
                            {question.tags.map((tag) => (
                              <span
                                key={`${question.id}-${tag}`}
                                className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </article>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
              <h3 className="text-sm font-semibold text-on-surface">Uploaded Syllabus PDFs</h3>
              {uploadedPdfs.length === 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">No approved uploads yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {uploadedPdfs.map((pdf) => (
                    <a
                      key={pdf.id}
                      href={pdf.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
                    >
                      {pdf.year ?? UNKNOWN_YEAR_LABEL} · {pdf.university ?? UNKNOWN_UNIVERSITY_LABEL} PDF
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link
              href={`/syllabus/${department}`}
              className="inline-flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
            >
              Back to {info.name} syllabus
            </Link>
          </aside>
        </div>
      </section>
    </MainLayout>
  );
}

import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
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
import { getAllSyllabusRows } from "@/lib/syllabus-cache";
import {
  SYLLABUS_DEPARTMENTS,
  syllabusDeptBySubjectCode,
  syllabusDeptSlugForPaperCode,
} from "@/lib/syllabus-departments";

const SITE_URL = "https://www.examarchive.dev";

interface PageProps {
  params: Promise<{ department: string; paper_code: string }>;
}

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
 * Bengali sentences end with the danda । (U+0964) / double danda ॥ and
 * start with a Bengali letter, so both are terminators and lookahead
 * targets — otherwise Bengali content never splits and renders as one
 * wall of text while English gets bullets.
 * Falls back to a single bullet when no clean split is found.
 */
function splitIntoBullets(content: string): string[] {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return [];
  // Split on ". " / "! " / "? " / "। " followed by a capital letter, digit
  // or Bengali letter, keeping common abbreviations intact.
  const parts = text
    .split(/(?<=[.!?।॥])\s+(?=[A-Z0-9\u0980-\u09FF])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  if (parts.length <= 1) return [text];
  return parts;
}

/** True when the text contains Bengali script — used for lang="bn". */
function isBengali(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
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
async function getPaperRows(paperCode: string) {
  const wanted = normalizePaperCode(paperCode);
  // Rows come from the shared 7-day syllabus cache instead of re-reading
  // the whole department from Appwrite on every paper visit.
  const rows = (await getAllSyllabusRows())
    .filter((row) => normalizePaperCode(row.paper_code) === wanted)
    .sort((a, b) => a.unit_number - b.unit_number);
  if (rows.length > 0) {
    return rows;
  }
  // Fallback: exact-code query for rows whose subject field disagrees with
  // the URL department (defensive: the cache covers published rows only).
  const db = adminDatabases();
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.syllabus_table,
    [Query.equal("paper_code", paperCode), Query.limit(200)],
  );
  return documents
    .map((doc) => toSyllabusTableRow(doc as Record<string, unknown>))
    .sort((a, b) => a.unit_number - b.unit_number);
}

// Cached per paper for 7 days: the lookups below cost up to ~100 reads
// per visit when run live (two limit(50) syllabus queries plus seeds).
const getUploadedSyllabusPdfs = unstable_cache(
  async (paperCode: string): Promise<Syllabus[]> => {
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
  },
  ["syllabus-pdfs"],
  { revalidate: 604800 },
);

function sortLinkedQuestions(a: LinkedQuestionRow, b: LinkedQuestionRow): number {
  const aNo = Number(a.question_no);
  const bNo = Number(b.question_no);
  if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
  if (a.question_no !== b.question_no) return a.question_no.localeCompare(b.question_no);
  if (a.question_subpart !== b.question_subpart) return a.question_subpart.localeCompare(b.question_subpart);
  return (b.year ?? 0) - (a.year ?? 0);
}

// Cached per paper for 7 days: the questions query reads up to 500 rows
// per visit when run live. The linked-IDs arrive as a sorted string array
// (a Set is not a serializable cache key), rebuilt into a Set inside.
const getLinkedQuestionRows = unstable_cache(
  async (paperCodes: string[], linkedSyllabusIdList: string[]) => {
  const linkedSyllabusIds = new Set(linkedSyllabusIdList);
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
  },
  ["linked-questions"],
  { revalidate: 604800 },
);

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
    getPaperRows(code),
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
  const { rowsToShow: linkedQuestions, filteredOutCount, usedFallbackToAll } = await getLinkedQuestionRows(rawCodes.length > 0 ? rawCodes : [code], [...linkedSyllabusIds].sort());

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
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:pt-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Assam University · {info.name}
          </p>
          <h1 className="mt-2 text-2xl font-black text-on-surface break-words sm:text-3xl" lang={isBengali(paperName) ? "bn" : undefined}>{paperName}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-surface-container px-2.5 py-1 font-mono text-xs font-semibold text-on-surface-variant">{code}</span>
            {semester > 0 && (
              <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">Semester {semester}</span>
            )}
            {first.type && (
              <span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">{first.type}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {[first.university, first.course].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-4">
            <a
              href={`/api/syllabus/table?paperCode=${encodeURIComponent(code)}&mode=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary sm:w-auto"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Download Syllabus PDF
            </a>
          </div>
        </div>

        {uploadedPdfs.filter((pdf) => pdf.file_url).length > 0 && (
          <div className="mt-5 lg:hidden">
            <p className="text-xs font-semibold text-on-surface-variant">Uploaded PDFs</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {uploadedPdfs.filter((pdf) => pdf.file_url).map((pdf) => (
                <a
                  key={pdf.id}
                  href={pdf.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full border border-outline-variant/40 bg-surface px-3 py-1.5 text-xs font-semibold text-on-surface"
                >
                  {[pdf.year, pdf.university].filter(Boolean).join(" · ") || "Syllabus PDF"}
                </a>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const maxUnit = rows.length > 0 ? Math.max(...rows.map((r) => r.unit_number)) : 0;
          const missingUnits = Array.from({ length: maxUnit }, (_, i) => i + 1).filter(
            (n) => !rows.some((r) => r.unit_number === n),
          );
          if (missingUnits.length === 0) return null;
          return (
            <p className="mt-5 rounded-xl bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
              Showing {rows.length} of {maxUnit} units — Units {missingUnits.join(", ")} are not published yet.
            </p>
          );
        })()}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <nav aria-label="Units" className="flex gap-1.5 overflow-x-auto pb-1">
              {rows.map((row) => (
                <a
                  key={row.id}
                  href={`#unit-${row.unit_number}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface"
                >
                  {row.unit_number}
                </a>
              ))}
            </nav>

            <div className="rounded-2xl border border-outline-variant/40 bg-surface divide-y divide-outline-variant/30 overflow-hidden">
              {rows.map((row) => {
                const bullets = splitIntoBullets(row.syllabus_content);
                const displayTags = row.tags.filter(isDisplayTag);
                const hasContent = row.syllabus_content.trim().length > 0;
                const bengali = isBengali(row.syllabus_content);
                return (
                <section
                  key={row.id}
                  id={`unit-${row.unit_number}`}
                  className="scroll-mt-24 px-4 py-4"
                  lang={bengali ? "bn" : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                      {row.unit_number}
                    </span>
                    <h2 className="text-base font-semibold text-on-surface break-words">Unit {row.unit_number}</h2>
                    {typeof row.lectures === "number" && (
                      <span className="ml-auto shrink-0 text-xs text-on-surface-variant">Lectures: {row.lectures}</span>
                    )}
                  </div>
                  {!hasContent ? (
                    <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
                      No content published for Unit {row.unit_number} yet.
                    </p>
                  ) : bullets.length > 1 ? (
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
                    variant="compact"
                    contentType="syllabus"
                    contentId={`syllabus:${canonicalCode}:unit:${row.unit_number}`}
                  />
                </section>
                );
              })}
            </div>

            <article className="rounded-2xl border border-outline-variant/40 bg-surface p-4 overflow-hidden">
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
                    {linkedQuestions.slice(0, 8).map((question) => (
                      <div key={question.id} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                        <p className="text-xs font-semibold text-on-surface-variant">
                          Q{question.question_no}
                          {question.question_subpart ? `(${question.question_subpart})` : ""}
                          {typeof question.year === "number" ? ` · ${question.year}` : ""}
                          {typeof question.marks === "number" ? ` · ${question.marks} marks` : ""}
                        </p>
                        <p className="mt-1 text-sm text-on-surface break-words">{question.question_content}</p>
                        {question.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  {linkedQuestions.length > 8 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer rounded-xl bg-surface-container px-3 py-2.5 text-center text-sm font-semibold text-on-surface">
                        Show all {linkedQuestions.length} questions
                      </summary>
                      <div className="mt-3 space-y-3">
                        {linkedQuestions.slice(8).map((question) => (
                          <div key={question.id} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                            <p className="text-xs font-semibold text-on-surface-variant">
                              Q{question.question_no}
                              {question.question_subpart ? `(${question.question_subpart})` : ""}
                              {typeof question.year === "number" ? ` · ${question.year}` : ""}
                              {typeof question.marks === "number" ? ` · ${question.marks} marks` : ""}
                            </p>
                            <p className="mt-1 text-sm text-on-surface break-words">{question.question_content}</p>
                            {question.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                    </details>
                  )}
                </>
              )}
            </article>
          </div>

          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
              <h3 className="text-sm font-semibold text-on-surface">Uploaded Syllabus PDFs</h3>
              {uploadedPdfs.filter((pdf) => pdf.file_url).length === 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">No approved uploads yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {uploadedPdfs.filter((pdf) => pdf.file_url).map((pdf) => (
                    <a
                      key={pdf.id}
                      href={pdf.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
                    >
                      {[pdf.year, pdf.university].filter(Boolean).join(" · ") || "Syllabus PDF"}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-outline-variant/40 bg-surface p-4">
              <h3 className="text-sm font-semibold text-on-surface">About this paper</h3>
              <dl className="mt-2 space-y-1.5 text-xs text-on-surface-variant">
                {[
                  ["University", first.university],
                  ["Course", first.course],
                  ["Stream", first.stream],
                  ["Type", first.type],
                  ["Semester", semester > 0 ? String(semester) : ""],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="shrink-0">{k}</dt>
                    <dd className="text-right font-medium text-on-surface break-words">{v}</dd>
                  </div>
                ))}
              </dl>
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

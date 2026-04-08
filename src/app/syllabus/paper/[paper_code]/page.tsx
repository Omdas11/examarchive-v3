import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import {
  derivePaperNameFromContent,
  toSyllabusTableRow,
} from "@/lib/syllabus-table";

interface PageProps {
  params: Promise<{ paper_code: string }>;
}

const UNKNOWN_YEAR_LABEL = "Unknown year";
const UNKNOWN_UNIVERSITY_LABEL = "Unknown university";
const MAX_QUESTIONS_PER_PAPER = 500;

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
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();
  return {
    title: `${code} Syllabus`,
    description: `Syllabus details sourced from Syllabus_Table for ${code}.`,
  };
}

async function getPaperRows(paperCode: string) {
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

async function getLinkedQuestionRows(paperCode: string, linkedSyllabusIds: Set<string>) {
  const db = adminDatabases();
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    COLLECTION.questions_table,
    [Query.equal("paper_code", paperCode), Query.limit(MAX_QUESTIONS_PER_PAPER)],
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
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  const [rows, uploadedPdfs] = await Promise.all([
    getPaperRows(code),
    getUploadedSyllabusPdfs(code),
  ]);

  if (rows.length === 0) {
    notFound();
  }

  const first = rows[0];
  const paperName = first.paper_name?.trim() || derivePaperNameFromContent(first.syllabus_content, code);
  const linkedSyllabusIds = new Set(
    rows.flatMap((row) => [row.entry_id, row.id]).filter((entryId): entryId is string => {
      if (typeof entryId !== "string") return false;
      return entryId.trim().length > 0;
    }),
  );
  const { rowsToShow: linkedQuestions, filteredOutCount, usedFallbackToAll } = await getLinkedQuestionRows(code, linkedSyllabusIds);

  return (
    <MainLayout
      title="Syllabus Detail"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Syllabus", href: "/syllabus" },
        { label: code },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
        <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Syllabus_Table Source
          </p>
          <h1 className="mt-2 text-3xl font-black text-on-surface">{paperName}</h1>
          <p className="mt-1 font-mono text-sm text-on-surface-variant">{code}</p>
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
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-outline-variant/40 bg-surface p-4"
              >
                <h2 className="text-lg font-semibold text-on-surface">Unit {row.unit_number}</h2>
                {typeof row.lectures === "number" && (
                  <p className="mt-1 text-xs text-on-surface-variant">Lectures: {row.lectures}</p>
                )}
                <p className="mt-3 whitespace-pre-wrap text-sm text-on-surface-variant">
                  {row.syllabus_content}
                </p>
                {row.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.tags.map((tag) => (
                      <span
                        key={`${row.id}-${tag}`}
                        className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}

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
              href="/syllabus"
              className="inline-flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
            >
              Back to catalog
            </Link>
          </aside>
        </div>
      </section>
    </MainLayout>
  );
}

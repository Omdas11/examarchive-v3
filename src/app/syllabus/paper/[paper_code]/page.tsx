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
import { formatIstDateTime } from "@/lib/datetime";
import { buildSyllabusJsonLd, serializeJsonLd } from "@/lib/json-ld";

interface PageProps {
  params: Promise<{ paper_code: string }>;
}

const UNKNOWN_YEAR_LABEL = "Unknown year";
const UNKNOWN_UNIVERSITY_LABEL = "Unknown university";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();
  return {
    title: `${code} Syllabus`,
    description: `Syllabus details sourced from Syllabus_Table for ${code}.`,
    alternates: {
      canonical: `/syllabus/paper/${encodeURIComponent(code)}`,
    },
    openGraph: {
      title: `${code} Syllabus | ExamArchive`,
      description: `Structured syllabus details for ${code} from the ExamArchive syllabus table.`,
      url: `https://www.examarchive.dev/syllabus/paper/${encodeURIComponent(code)}`,
      type: "article",
    },
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
  const lastVerifiedAt = uploadedPdfs[0]?.created_at ?? new Date().toISOString();
  const syllabusJsonLd = buildSyllabusJsonLd({
    paperCode: code,
    paperName,
    university: first.university,
    urlPath: `/syllabus/paper/${encodeURIComponent(code)}`,
  });

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
      <script type="application/ld+json">
        {serializeJsonLd(syllabusJsonLd)}
      </script>
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
          <p className="mt-1 text-xs text-on-surface-variant">
            Last verified {formatIstDateTime(lastVerifiedAt)} IST
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
            <a
              href={`mailto:feedback@examarchive.dev?subject=${encodeURIComponent(`Wrong syllabus: ${code}`)}&body=${encodeURIComponent(`Please review syllabus page /syllabus/paper/${code}`)}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
            >
              Report wrong syllabus
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

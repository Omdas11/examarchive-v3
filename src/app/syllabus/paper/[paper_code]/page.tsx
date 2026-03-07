import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { toSyllabus } from "@/types";
import type { Syllabus } from "@/types";
import { SYLLABUS_REGISTRY, groupBySemester } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry } from "@/data/syllabus-registry";
import { toRoman } from "@/lib/utils";

interface PageProps {
  params: Promise<{ paper_code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code);
  const entry = SYLLABUS_REGISTRY.find(
    (e) => e.paper_code.toUpperCase() === code.toUpperCase(),
  );
  return {
    title: entry ? `${entry.paper_code} – ${entry.paper_name}` : `Syllabus: ${code}`,
    description: entry
      ? `Syllabus details for ${entry.paper_name} (${entry.paper_code}), Semester ${entry.semester}, ${entry.university}.`
      : `Syllabus details for paper code ${code}.`,
  };
}

/** Fetch any uploaded PDFs for this paper code from the database. */
async function fetchSyllabusPdfs(paperCode: string): Promise<Syllabus[]> {
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [
        Query.equal("approval_status", "approved"),
        Query.equal("course_code", paperCode),
        Query.orderDesc("$createdAt"),
      ],
    );
    return documents.map(toSyllabus);
  } catch {
    return [];
  }
}

/** Render a single metadata row. */
function MetaRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex gap-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <span className="w-32 shrink-0 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default async function SyllabusDetailPage({ params }: PageProps) {
  const { paper_code } = await params;
  const code = decodeURIComponent(paper_code).toUpperCase();

  const entry: SyllabusRegistryEntry | undefined = SYLLABUS_REGISTRY.find(
    (e) => e.paper_code.toUpperCase() === code,
  );

  if (!entry) {
    notFound();
  }

  const pdfs = await fetchSyllabusPdfs(entry.paper_code);

  // Build the semester group for the same subject/programme to show related papers
  const relatedEntries = SYLLABUS_REGISTRY.filter(
    (e) =>
      e.subject === entry.subject &&
      e.programme === entry.programme &&
      e.university === entry.university &&
      e.paper_code !== entry.paper_code,
  );
  const relatedBySem = groupBySemester(relatedEntries);

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Back link */}
      <Link
        href="/syllabus"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: "var(--color-text-muted)" }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Syllabus
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold font-mono"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {entry.paper_code}
            </span>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {entry.programme}
            </span>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[11px]"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              Semester {toRoman(entry.semester)}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-snug">{entry.paper_name}</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {entry.university}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Left: metadata */}
        <div className="lg:col-span-2 space-y-6">
          {/* Paper details card */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3">Paper Details</h2>
            <MetaRow label="Paper Code" value={entry.paper_code} />
            <MetaRow label="Paper Name" value={entry.paper_name} />
            <MetaRow label="Subject" value={entry.subject} />
            <MetaRow label="Semester" value={`${toRoman(entry.semester)} (Semester ${entry.semester})`} />
            <MetaRow label="Credits" value={entry.credits} />
            <MetaRow label="Programme" value={entry.programme} />
            <MetaRow label="University" value={entry.university} />
          </div>

          {/* Uploaded PDFs */}
          {pdfs.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Uploaded Syllabus PDFs</h2>
              <div className="space-y-3">
                {pdfs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2"
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                  >
                    <div>
                      <p className="text-sm font-medium">{s.subject || s.course_name || "Syllabus PDF"}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {s.year ? `${s.year} · ` : ""}
                        {s.university}
                      </p>
                    </div>
                    {s.file_url && (
                      <a
                        href={s.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn text-xs shrink-0"
                      >
                        View PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pdfs.length === 0 && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{
                background: "var(--color-accent-soft)",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              No uploaded syllabus PDFs for this paper yet.{" "}
              <a href="/upload?type=syllabus" style={{ color: "var(--color-primary)" }}>
                Upload one
              </a>
              .
            </div>
          )}
        </div>

        {/* Right: related papers */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3">
              Related Papers — {entry.subject}
            </h2>
            {relatedBySem.size === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                No other papers found for this subject.
              </p>
            ) : (
              Array.from(relatedBySem.entries()).map(([sem, items]) => (
                <div key={sem} className="mb-3">
                  <p
                    className="text-[11px] font-semibold mb-1.5 uppercase"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Semester {toRoman(sem)}
                  </p>
                  <ul className="space-y-1">
                    {items.map((rel: SyllabusRegistryEntry) => (
                      <li key={rel.paper_code}>
                        <Link
                          href={`/syllabus/paper/${encodeURIComponent(rel.paper_code)}`}
                          className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                          style={{ color: "var(--color-primary)" }}
                        >
                          <span className="font-mono">{rel.paper_code}</span>
                          <span style={{ color: "var(--color-text-muted)" }}>— {rel.paper_name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Upload CTA */}
          <div className="card p-4 text-center">
            <p className="text-sm font-medium mb-2">Have the syllabus PDF?</p>
            <a href="/upload?type=syllabus" className="btn-primary text-sm w-full block text-center">
              Upload Syllabus PDF
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

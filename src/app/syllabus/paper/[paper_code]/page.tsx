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
import type { SyllabusRegistryEntry, SyllabusUnit } from "@/data/syllabus-registry";
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
      <span className="w-36 shrink-0 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

/** Render all units and their topics for a paper. */
function UnitsSection({ units }: { units: SyllabusUnit[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold mb-4">Syllabus Units &amp; Topics</h2>
      <div className="space-y-5">
        {units.map((u) => (
          <div key={u.unit}>
            {/* Unit heading */}
            <div className="flex items-baseline gap-3 mb-2">
              <span
                className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
              >
                {u.unit}
              </span>
              <div className="flex flex-1 items-baseline justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">
                  Unit {u.unit}: {u.name}
                </h3>
                {u.lectures != null && (
                  <span
                    className="text-[11px] shrink-0"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    ({u.lectures} Lectures)
                  </span>
                )}
              </div>
            </div>
            {/* Topics list */}
            <ul className="ml-9 space-y-1">
              {u.topics.map((topic, ti) => (
                <li
                  key={ti}
                  className="flex gap-2 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-primary)" }} />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

import { PAPER_TYPE_COLORS } from "@/components/PaperCard";

/** Category badge colour mapping. */
const CATEGORY_COLORS = PAPER_TYPE_COLORS;

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

  // Related papers: same subject + programme + university, different code
  const relatedEntries = SYLLABUS_REGISTRY.filter(
    (e) =>
      e.subject === entry.subject &&
      e.programme === entry.programme &&
      e.university === entry.university &&
      e.paper_code !== entry.paper_code,
  );
  const relatedBySem = groupBySemester(relatedEntries);

  const catColors = entry.category
    ? CATEGORY_COLORS[entry.category] ?? { bg: "var(--color-border)", text: "var(--color-text-muted)" }
    : null;

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
            {catColors && entry.category && (
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: catColors.bg, color: catColors.text }}
              >
                {entry.category}
              </span>
            )}
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
        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Paper details */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3">Paper Details</h2>
            <MetaRow label="Paper Code" value={entry.paper_code} />
            <MetaRow label="Paper Name" value={entry.paper_name} />
            <MetaRow label="Subject" value={entry.subject} />
            <MetaRow label="Semester" value={`${toRoman(entry.semester)} (Semester ${entry.semester})`} />
            <MetaRow label="Credits" value={entry.credits} />
            {entry.contact_hours != null && (
              <MetaRow label="Contact Hours" value={`${entry.contact_hours} hrs`} />
            )}
            {entry.full_marks != null && (
              <MetaRow label="Full Marks" value={entry.full_marks} />
            )}
            {entry.category && (
              <MetaRow label="Category" value={entry.category} />
            )}
            <MetaRow label="Programme" value={entry.programme} />
            <MetaRow label="University" value={entry.university} />
          </div>

          {/* Course objective */}
          {entry.course_objective && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-2">Course Objective</h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {entry.course_objective}
              </p>
            </div>
          )}

          {/* Units & Topics */}
          {entry.units && entry.units.length > 0 && (
            <UnitsSection units={entry.units} />
          )}

          {/* Learning outcomes */}
          {entry.learning_outcomes && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-2">Expected Learning Outcomes</h2>
              <p className="text-sm leading-relaxed italic" style={{ color: "var(--color-text-muted)" }}>
                {entry.learning_outcomes}
              </p>
            </div>
          )}

          {/* Reference books */}
          {entry.reference_books && entry.reference_books.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-3">Reference Books</h2>
              <ol className="space-y-1.5 list-none">
                {entry.reference_books.map((book, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                    <span className="shrink-0 font-medium" style={{ color: "var(--color-primary)" }}>
                      {String(i + 1).padStart(2, "0")}.
                    </span>
                    <span>{book}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

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

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="card p-4 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>
                {entry.credits}
              </p>
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Credits</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>
                {entry.units?.length ?? "—"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Units</p>
            </div>
            {entry.contact_hours != null && (
              <div className="text-center col-span-2">
                <p className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>
                  {entry.contact_hours}
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Contact Hours</p>
              </div>
            )}
          </div>

          {/* Related papers */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3">
              Related Papers
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
                          className="flex flex-col gap-0.5 text-xs hover:opacity-70 transition-opacity"
                        >
                          <span className="font-mono font-semibold" style={{ color: "var(--color-primary)" }}>
                            {rel.paper_code}
                          </span>
                          <span style={{ color: "var(--color-text-muted)" }}>{rel.paper_name}</span>
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


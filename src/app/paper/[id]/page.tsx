import type { Metadata } from "next";
import Link from "next/link";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Paper } from "@/types";
import { toPaper } from "@/types";
import { toRoman } from "@/lib/utils";
import { SYLLABUS_REGISTRY } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry, SyllabusUnit } from "@/data/syllabus-registry";
import { PAPER_TYPE_COLORS } from "@/components/PaperCard";

interface PaperPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
    return {
      title: `${doc.title} – ${doc.course_code}`,
      description: `Download ${doc.title} for ${doc.course_name} (${doc.course_code}).`,
    };
  } catch {
    return { title: "Paper Not Found" };
  }
}

export default async function PaperPage({ params }: PaperPageProps) {
  const { id } = await params;
  let paper: Paper | null = null;
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
    paper = toPaper(doc);
  } catch {
    // document not found
  }

  if (!paper) {
    return (
      <section className="mx-auto px-4 py-20 text-center" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">Paper Not Found</h1>
        <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
          The requested paper does not exist or has been removed.
        </p>
        <Link href="/browse" className="btn-primary mt-5 inline-block">← Browse Papers</Link>
      </section>
    );
  }

  const semRoman = paper.semester ? toRoman(parseInt(paper.semester, 10)) : paper.semester;

  const metaBadges = [
    paper.institution,
    paper.programme,
    paper.department,
    semRoman ? `Sem ${semRoman}` : null,
    paper.year && String(paper.year),
    paper.exam_type,
  ].filter(Boolean) as string[];

  const uploaderDisplay = paper.uploaded_by_username
    ? `@${paper.uploaded_by_username}`
    : null;

  // Look up structured syllabus data from the registry by course_code.
  const courseCode = paper.course_code;
  const syllabusEntry: SyllabusRegistryEntry | undefined = courseCode
    ? SYLLABUS_REGISTRY.find(
        (e) => e.paper_code.toUpperCase() === courseCode.toUpperCase(),
      )
    : undefined;

  // Fetch all approved papers with the same course_code for multi-year view.
  let relatedPapers: Paper[] = [];
  if (courseCode) {
    try {
      const db = adminDatabases();
      const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.equal("course_code", courseCode),
        Query.orderDesc("$createdAt"),
        Query.limit(20),
      ]);
      relatedPapers = documents.map(toPaper).filter((p) => p.id !== paper!.id);
    } catch {
      // ignore
    }
  }

  return (
    <section className="mx-auto px-4 py-8 space-y-4" style={{ maxWidth: "var(--max-w)" }}>

      {/* ── Back link ── */}
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: "var(--color-text-muted)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Browse Papers
      </Link>

      {/* ── Paper header card ── */}
      <div className="card p-5 sm:p-6">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>
          {paper.course_code}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold leading-snug">{paper.title}</h1>
        {paper.course_name && paper.course_name !== paper.title && (
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>{paper.course_name}</p>
        )}

        {/* Meta badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {metaBadges.map((b) => (
            <span
              key={b}
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {b}
            </span>
          ))}
        </div>

        {/* Uploader + stats */}
        {(uploaderDisplay || (paper.view_count ?? 0) > 0 || (paper.download_count ?? 0) > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {uploaderDisplay && <span>Uploaded by {uploaderDisplay}</span>}
            {(paper.view_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                {paper.view_count} views
              </span>
            )}
            {(paper.download_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                </svg>
                {paper.download_count} downloads
              </span>
            )}
          </div>
        )}

        <a
          href={paper.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-5 block w-full text-center"
        >
          Open Latest PDF →
        </a>
      </div>

      {/* ── Available papers ── */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold mb-3">Available Question Papers</h2>
        <ul className="space-y-2">
          {/* Current paper */}
          <li
            className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <span>
              {paper.year} — Sem {semRoman}
              {paper.exam_type && ` · ${paper.exam_type}`}
            </span>
            <a
              href={paper.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium ml-4 shrink-0"
              style={{ color: "var(--color-primary)" }}
            >
              View PDF
            </a>
          </li>
          {/* Other papers for same course code */}
          {relatedPapers.map((rp) => (
            <li
              key={rp.id}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
            >
              <span>
                {rp.year} — Sem {rp.semester ? toRoman(parseInt(rp.semester, 10)) : rp.semester}
                {rp.exam_type && ` · ${rp.exam_type}`}
              </span>
              <Link
                href={`/paper/${rp.id}`}
                className="font-medium ml-4 shrink-0"
                style={{ color: "var(--color-primary)" }}
              >
                View PDF
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Syllabus ── */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold mb-3">Syllabus</h2>
        {syllabusEntry ? (
          <div className="space-y-4">
            {/* Paper meta */}
            <div className="flex flex-wrap gap-1.5">
              {syllabusEntry.category && PAPER_TYPE_COLORS[syllabusEntry.category] && (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: PAPER_TYPE_COLORS[syllabusEntry.category].bg,
                    color: PAPER_TYPE_COLORS[syllabusEntry.category].text,
                  }}
                >
                  {syllabusEntry.category}
                </span>
              )}
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-xs"
                style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
              >
                {syllabusEntry.credits} Credits
              </span>
              {syllabusEntry.contact_hours != null && (
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs"
                  style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  {syllabusEntry.contact_hours} hrs
                </span>
              )}
            </div>

            {/* Units summary */}
            {syllabusEntry.units && syllabusEntry.units.length > 0 && (
              <div className="space-y-2">
                {syllabusEntry.units.map((unit: SyllabusUnit) => (
                  <div
                    key={unit.unit}
                    className="flex gap-3 rounded-lg px-3 py-2.5 text-sm"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
                    >
                      {unit.unit}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs leading-snug">{unit.name}</p>
                      {unit.lectures != null && (
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                          {unit.lectures} lectures
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Link to full syllabus detail */}
            <Link
              href={`/syllabus/paper/${encodeURIComponent(syllabusEntry.paper_code)}`}
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: "var(--color-primary)" }}
            >
              View full syllabus →
            </Link>
          </div>
        ) : (
          <div className="rounded-lg px-4 py-5 text-center" style={{ background: "var(--color-accent-soft)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Coming Soon</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Syllabus information will be linked here once available.
            </p>
          </div>
        )}
      </div>

      {/* ── Repeated Questions ── */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold mb-3">All Available Papers for This Course</h2>
        {relatedPapers.length > 0 ? (
          <>
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              Other question papers with the same course code ({courseCode}) from different years or exams.
            </p>
            <ul className="space-y-2">
              {relatedPapers.map((rp) => (
                <li key={rp.id}>
                  <Link
                    href={`/paper/${rp.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all hover:shadow-sm"
                    style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", textDecoration: "none", color: "inherit" }}
                  >
                    <span>
                      {rp.year} — Sem {rp.semester ? toRoman(parseInt(rp.semester, 10)) : rp.semester}
                      {rp.exam_type && ` · ${rp.exam_type}`}
                    </span>
                    <span className="font-medium ml-4 shrink-0 text-xs" style={{ color: "var(--color-primary)" }}>
                      View →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            No other papers available for this course code yet.{" "}
            <a href="/upload" style={{ color: "var(--color-primary)" }}>Upload one</a>.
          </p>
        )}
      </div>

      {/* ── Notes & Resources ── */}
      <div className="card p-5 sm:p-6">
        <h2 className="text-base font-semibold mb-3">Notes &amp; Resources</h2>
        {syllabusEntry?.reference_books && syllabusEntry.reference_books.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
              Recommended reference books from the syllabus:
            </p>
            <ol className="space-y-1.5 list-none">
              {syllabusEntry.reference_books.map((book, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
                  <span className="shrink-0 font-medium" style={{ color: "var(--color-primary)" }}>
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span>{book}</span>
                </li>
              ))}
            </ol>
            {syllabusEntry && (
              <Link
                href={`/syllabus/paper/${encodeURIComponent(syllabusEntry.paper_code)}`}
                className="inline-flex items-center gap-1 text-xs font-medium mt-3"
                style={{ color: "var(--color-primary)" }}
              >
                View full syllabus →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {syllabusEntry
              ? "No reference books listed for this paper."
              : "Notes and resources will appear here once the syllabus is available."}
            {syllabusEntry && (
              <>
                {" "}
                <Link
                  href={`/syllabus/paper/${encodeURIComponent(syllabusEntry.paper_code)}`}
                  style={{ color: "var(--color-primary)" }}
                >
                  View syllabus →
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

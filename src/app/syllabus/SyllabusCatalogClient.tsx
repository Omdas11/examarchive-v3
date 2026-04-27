"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Syllabus } from "@/types";
import type { SyllabusTablePaperSummary } from "@/lib/syllabus-table";

/** Map of uploaded-syllabus PDFs keyed by paper code (upper-case). */
type PdfsByCode = Map<string, Syllabus[]>;

/** Returns the display name for a paper's subject, falling back to subjectCode. */
function getSubjectDisplay(paper: Pick<SyllabusTablePaperSummary, "subject" | "subjectCode">): string {
  return paper.subject || paper.subjectCode;
}

function PaperCard({
  paper,
  uploadedPdfs,
  serialNo,
}: {
  paper: SyllabusTablePaperSummary;
  uploadedPdfs: PdfsByCode;
  serialNo: number;
}) {
  const pdfs = uploadedPdfs.get(paper.paperCode.toUpperCase()) ?? [];
  const [expanded, setExpanded] = useState(false);

  // Group question papers by year
  const yearGroups = paper.questionPapers.reduce<Map<number, Array<{ paperId: string; examType?: string }>>>(
    (acc, qp) => {
      const list = acc.get(qp.year) ?? [];
      list.push({ paperId: qp.paperId, examType: qp.examType });
      acc.set(qp.year, list);
      return acc;
    },
    new Map(),
  );
  const sortedYears = Array.from(yearGroups.keys()).sort((a, b) => b - a);
  const visibleYears = expanded ? sortedYears : sortedYears.slice(0, 4);
  const hasMore = sortedYears.length > 4;

  return (
    <div className="group rounded-2xl border border-outline-variant/30 bg-surface shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
      {/* Colour bar: spread hues evenly across cards using the serial number */}
      <div
        className="h-1 w-full"
        style={{ background: `hsl(${(serialNo * 43) % 360}, 60%, 50%)` }}
        aria-hidden="true"
      />

      <div className="p-4 sm:p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
              {paper.paperCode}
            </span>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-on-surface line-clamp-2">
              {paper.paperName || getSubjectDisplay(paper)}
            </h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-on-surface-variant">
            {typeof paper.credits === "number" && (
              <span className="rounded-full bg-surface-container px-2 py-0.5 font-semibold">
                {paper.credits} cr
              </span>
            )}
            {paper.lectures && (
              <span className="rounded-full bg-surface-container px-2 py-0.5">
                {paper.lectures} lec
              </span>
            )}
          </div>
        </div>

        {/* Subject / university meta */}
        <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-1">
          {[getSubjectDisplay(paper), paper.university, paper.course].filter(Boolean).join(" · ")}
        </p>

        {/* Question paper year badges */}
        {sortedYears.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Question Papers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleYears.map((year) => {
                const items = yearGroups.get(year) ?? [];
                return items.map((item) => (
                  <Link
                    key={`${year}-${item.paperId}`}
                    href={`/paper/${item.paperId}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface transition-colors hover:bg-primary/10 hover:text-primary"
                    title={item.examType ? `${year} · ${item.examType}` : String(year)}
                  >
                    {year}
                    {item.examType && (
                      <span className="rounded-full bg-surface px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                        {item.examType.slice(0, 3)}
                      </span>
                    )}
                  </Link>
                ));
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="rounded-lg bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
                >
                  {expanded ? "Less ▲" : `+${sortedYears.length - 4} more`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Uploaded PDFs */}
        {pdfs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pdfs.map((pdf) => (
              <a
                key={pdf.id}
                href={pdf.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF{pdf.year ? ` (${pdf.year})` : ""}
              </a>
            ))}
          </div>
        )}

        {/* Action links */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant/30 pt-3">
          <Link
            href={`/syllabus/paper/${encodeURIComponent(paper.paperCode)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Syllabus
          </Link>
          <a
            href={`/api/syllabus/table?paperCode=${encodeURIComponent(paper.paperCode)}&mode=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-1.5 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Syllabus PDF
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SyllabusCatalogClient({ syllabi }: { syllabi: Syllabus[] }) {
  const [activeSubject, setActiveSubject] = useState<string>("All");
  const [papers, setPapers] = useState<SyllabusTablePaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadLibrary() {
      setLoading(true);
      try {
        const res = await fetch("/api/syllabus/table");
        if (!res.ok) throw new Error(`Failed with status ${res.status}: ${res.statusText}`);
        const data = await res.json();
        if (!cancelled) {
          setPapers(Array.isArray(data.papers) ? data.papers : []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[syllabus] table fetch failed", err);
          setError("Unable to load syllabus library right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Map uploaded PDFs by paper code (upper-case) for O(1) lookup. */
  const uploadedPdfs: PdfsByCode = useMemo(() => {
    const map = new Map<string, Syllabus[]>();
    for (const s of syllabi) {
      const key = (s.course_code ?? "").toUpperCase();
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [syllabi]);

  /** Unique subject names for filter chips. */
  const subjectFilters = useMemo(() => {
    const subjects = new Set<string>();
    for (const p of papers) subjects.add(getSubjectDisplay(p));
    return ["All", ...Array.from(subjects).sort((a, b) => a.localeCompare(b))];
  }, [papers]);

  /** Papers visible under current subject filter. */
  const filteredPapers = useMemo(() => {
    if (activeSubject === "All") return papers;
    return papers.filter((p) => getSubjectDisplay(p) === activeSubject);
  }, [papers, activeSubject]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="space-y-6 rounded-[36px] bg-gradient-to-b from-surface to-surface-container-lowest p-5 shadow-inner shadow-primary/5 ring-1 ring-primary/5">

        {/* ── Header ── */}
        <header className="rounded-[28px] bg-surface p-6 shadow-sm shadow-primary/10 ring-1 ring-surface-container-high/40 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black leading-tight text-on-surface">Syllabus Catalog</h1>
              <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
                Browse curriculum by subject. Each card shows syllabus details and available question papers by year.
              </p>
            </div>
            {!loading && !error && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {filteredPapers.length} paper{filteredPapers.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Subject filter chips */}
          {!loading && !error && subjectFilters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {subjectFilters.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setActiveSubject(sub)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition shadow-sm",
                    activeSubject === sub
                      ? "bg-primary text-on-primary shadow-md shadow-primary/30"
                      : "bg-surface-container text-on-surface hover:bg-surface-container-high",
                  )}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ── Uploaded original PDFs banner ── */}
        {syllabi.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800 mb-2">
              <span className="material-symbols-outlined align-middle text-base mr-1">picture_as_pdf</span>
              Uploaded Original Syllabi ({syllabi.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {syllabi.map((s) => (
                <a
                  key={s.id}
                  href={s.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50"
                >
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                  {s.subject || s.course_name || s.course_code || "Syllabus"}
                  {s.year ? ` (${s.year})` : ""}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Main content ── */}
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-5 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            Loading syllabus library…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error">
            {error}
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 text-center text-sm text-on-surface-variant">
            No syllabus entries found. Check back after papers have been ingested.
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {filteredPapers.map((paper, idx) => (
              <PaperCard
                key={paper.paperCode}
                serialNo={idx + 1}
                paper={paper}
                uploadedPdfs={uploadedPdfs}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


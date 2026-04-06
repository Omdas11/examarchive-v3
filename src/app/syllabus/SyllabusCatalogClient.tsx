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

function SyllabusRow({
  paper,
  uploadedPdfs,
  serialNo,
  years,
}: {
  paper: SyllabusTablePaperSummary;
  uploadedPdfs: PdfsByCode;
  serialNo: number;
  years: number[];
}) {
  const pdfs = uploadedPdfs.get(paper.paperCode.toUpperCase()) ?? [];
  const yearsByValue = paper.questionPapers.reduce<Map<number, Array<{ paperId: string; examType?: string }>>>((acc, qp) => {
    const list = acc.get(qp.year) ?? [];
    list.push({ paperId: qp.paperId, examType: qp.examType });
    acc.set(qp.year, list);
    return acc;
  }, new Map());
  return (
    <tr className="border-b border-outline-variant/30 last:border-0 hover:bg-surface-container-low/60 transition-colors">
      <td className="py-3 pl-4 pr-2 align-top text-sm text-on-surface-variant">{serialNo}</td>
      <td className="py-3 px-2 align-top text-sm font-medium text-on-surface">
        {getSubjectDisplay(paper)}
      </td>
      <td className="py-3 pl-2 pr-2 align-top">
        <Link
          href={`/syllabus/paper/${encodeURIComponent(paper.paperCode)}`}
          className="font-mono text-xs font-semibold text-primary hover:underline"
        >
          {paper.paperCode}
        </Link>
      </td>
      <td className="py-3 px-2 align-top min-w-[200px]">
        <p className="text-sm font-medium text-on-surface leading-snug">{paper.paperName || paper.paperCode}</p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant">
          {[paper.university, paper.course, paper.type].filter(Boolean).join(" · ")}
        </p>
      </td>
      <td className="py-3 px-2 align-middle text-center text-sm text-on-surface-variant">
        {typeof paper.credits === "number" ? paper.credits : "—"}
      </td>
      <td className="py-3 px-2 align-middle text-center">
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
          {paper.lectures || "—"}
        </span>
      </td>
      {years.map((year) => {
        const items = yearsByValue.get(year) ?? [];
        if (items.length === 0) {
          return (
            <td key={`${paper.paperCode}-${year}`} className="py-3 px-1 text-center text-xs text-on-surface-variant">
              —
            </td>
          );
        }
        return (
          <td key={`${paper.paperCode}-${year}`} className="py-3 px-1 text-center">
            <div className="flex flex-col items-center gap-1">
              {items.map((item) => (
                <Link
                  key={`${year}-${item.paperId}-${item.examType ?? ""}`}
                  href={`/paper/${item.paperId}`}
                  className="rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-semibold text-primary hover:underline"
                  title={item.examType ? `${year} · ${item.examType}` : String(year)}
                >
                  {item.examType ? item.examType.slice(0, 3).toUpperCase() : "PDF"}
                </Link>
              ))}
            </div>
          </td>
        );
      })}
      <td className="py-3 pl-2 pr-4 align-middle">
        <div className="flex flex-wrap items-center gap-1.5 justify-end">
          <Link
            href={`/syllabus/paper/${encodeURIComponent(paper.paperCode)}`}
            className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-primary whitespace-nowrap"
          >
            View Syllabus
          </Link>
          <a
            href={`/api/syllabus/table?paperCode=${encodeURIComponent(paper.paperCode)}&mode=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface whitespace-nowrap ring-1 ring-outline-variant/40"
          >
            Syllabus PDF
          </a>
          {pdfs.map((pdf) => (
            <a
              key={pdf.id}
              href={pdf.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap ring-1 ring-emerald-200"
            >
              Uploaded PDF {pdf.year ? `(${pdf.year})` : ""}
            </a>
          ))}
        </div>
      </td>
    </tr>
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

  /** All years across filtered papers, sorted ascending. */
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of filteredPapers) {
      for (const qp of p.questionPapers) set.add(qp.year);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [filteredPapers]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="space-y-6 rounded-[36px] bg-gradient-to-b from-surface to-surface-container-lowest p-5 shadow-inner shadow-primary/5 ring-1 ring-primary/5">

        {/* ── Header ── */}
        <header className="rounded-[28px] bg-surface p-6 shadow-sm shadow-primary/10 ring-1 ring-surface-container-high/40 space-y-4">
          <div>
            <h1 className="text-4xl font-black leading-tight text-on-surface">Syllabus Catalog</h1>
            <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
              Browse curriculum by subject. The table shows syllabus details and available question papers by year.
            </p>
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
          <div className="rounded-2xl border border-outline-variant/40 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="py-2 pl-4 pr-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Sl.</th>
                    <th className="py-2 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Subject</th>
                    <th className="py-2 pl-2 pr-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Code</th>
                    <th className="py-2 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Paper Name</th>
                    <th className="py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Credit</th>
                    <th className="py-2 px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Lecture</th>
                    {years.map((year) => (
                      <th
                        key={`year-head-${year}`}
                        className="py-2 px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant"
                      >
                        {year}
                      </th>
                    ))}
                    <th className="py-2 pl-2 pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Actions</th>
                  </tr>
                  {years.length > 0 && (
                    <tr className="bg-surface-container-low/70">
                      <th className="py-1 pl-4 pr-2" />
                      <th className="py-1 px-2" />
                      <th className="py-1 pl-2 pr-2" />
                      <th className="py-1 px-2" />
                      <th className="py-1 px-2" />
                      <th className="py-1 px-2" />
                      <th
                        className="py-1 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant"
                        colSpan={years.length}
                      >
                        Question Papers
                      </th>
                      <th className="py-1 pl-2 pr-4" />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filteredPapers.map((paper, idx) => (
                    <SyllabusRow
                      key={paper.paperCode}
                      serialNo={idx + 1}
                      paper={paper}
                      uploadedPdfs={uploadedPdfs}
                      years={years}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

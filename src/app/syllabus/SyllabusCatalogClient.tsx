"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Syllabus } from "@/types";
import type { SyllabusTablePaperSummary } from "@/lib/syllabus-table";

/** Map of uploaded-syllabus PDFs keyed by paper code (upper-case). */
type PdfsByCode = Map<string, Syllabus[]>;

type ActiveTab = "catalog" | "pdfs";

/** Shared grid style for PDF card grids. */
const PDF_GRID_STYLE = { gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" } as const;
/** Shared grid style for paper catalog card grids. */
const PAPER_GRID_STYLE = { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" } as const;

/** Returns the display name for a paper's subject, falling back to subjectCode. */
function getSubjectDisplay(paper: Pick<SyllabusTablePaperSummary, "subject" | "subjectCode">): string {
  return paper.subject || paper.subjectCode;
}

/** Programme badge colours. */
const PROGRAMME_BADGE: Record<string, { bg: string; text: string }> = {
  FYUG: { bg: "#dbeafe", text: "#1d4ed8" },
  NEP:  { bg: "#fef3c7", text: "#92400e" },
};
function programmeBadge(prog?: string) {
  if (!prog) return null;
  const upper = prog.toUpperCase();
  for (const [key, style] of Object.entries(PROGRAMME_BADGE)) {
    if (upper.includes(key)) return { label: prog, ...style };
  }
  return { label: prog, bg: "var(--color-border)", text: "var(--color-text-muted)" };
}

// ─── PDF Card ────────────────────────────────────────────────────────────────

function SyllabusPdfCard({ s }: { s: Syllabus }) {
  const isDept = !s.semester || s.semester === "";
  const badge = programmeBadge(s.programme);
  const dateStr = s.created_at
    ? new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const title = s.subject || s.course_name || s.course_code || "Syllabus";

  return (
    <a
      href={s.file_url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open PDF for ${title}`}
      className="group flex flex-col gap-3 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {/* Top accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "var(--color-primary)" }}
        aria-hidden="true"
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {isDept ? (
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700">
              DEPT
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
              SEM
            </span>
          )}
          {badge && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{ background: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
          )}
        </div>
        {/* Year badge */}
        <span className="shrink-0 rounded-xl bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-on-surface-variant">
          {s.year && s.year > 0 ? s.year : "—"}
        </span>
      </div>

      {/* Title */}
      <div>
        <p className="text-sm font-semibold leading-snug text-on-surface line-clamp-2">{title}</p>
        <p className="mt-0.5 text-[11px] text-on-surface-variant line-clamp-1">
          {[s.university, s.department, s.semester ? `Semester ${s.semester}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
        {dateStr && <span>{dateStr}</span>}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary transition-transform group-hover:translate-x-0.5">
          Open PDF
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </span>
      </div>
    </a>
  );
}

// ─── Paper Card ──────────────────────────────────────────────────────────────

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
  const hue = (serialNo * 43) % 360;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Hue accent */}
      <div className="h-1 w-full shrink-0" style={{ background: `hsl(${hue},60%,52%)` }} aria-hidden="true" />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
              {paper.paperCode}
            </span>
            <h3 className="mt-1.5 text-sm font-semibold leading-snug text-on-surface line-clamp-2">
              {paper.paperName || getSubjectDisplay(paper)}
            </h3>
          </div>
          {/* Credit / lecture badges */}
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

        {/* Meta */}
        <p className="text-[11px] text-on-surface-variant line-clamp-1">
          {[getSubjectDisplay(paper), paper.university, paper.course].filter(Boolean).join(" · ")}
        </p>

        {/* Question paper years */}
        {sortedYears.length > 0 && (
          <div>
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

        {/* Linked PDF badge */}
        {pdfs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pdfs.map((pdf) => (
              <a
                key={pdf.id}
                href={pdf.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF{pdf.year ? ` (${pdf.year})` : ""}
              </a>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-wrap gap-2 border-t border-outline-variant/20 pt-3">
          <Link
            href={`/syllabus/paper/${encodeURIComponent(paper.paperCode)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-on-primary transition-opacity hover:opacity-90"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View
          </Link>
          <a
            href={`/api/syllabus/table?paperCode=${encodeURIComponent(paper.paperCode)}&mode=pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 py-1.5 text-[11px] font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SyllabusCatalogClient({ syllabi }: { syllabi: Syllabus[] }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("catalog");
  const [activeSubject, setActiveSubject] = useState<string>("All");
  const [pdfFilter, setPdfFilter] = useState<"all" | "dept" | "sem">("all");
  const [search, setSearch] = useState("");
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
    return () => { cancelled = true; };
  }, []);

  // Split syllabi into departmental vs semester-specific
  const deptSyllabi = useMemo(() => syllabi.filter((s) => !s.semester || s.semester === ""), [syllabi]);
  const semSyllabi  = useMemo(() => syllabi.filter((s) => !!s.semester && s.semester !== ""), [syllabi]);
  const filteredSyllabi = useMemo(() => {
    if (pdfFilter === "dept") return deptSyllabi;
    if (pdfFilter === "sem")  return semSyllabi;
    return syllabi;
  }, [syllabi, deptSyllabi, semSyllabi, pdfFilter]);

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

  /** Papers after subject + search filter. */
  const filteredPapers = useMemo(() => {
    let list = activeSubject === "All" ? papers : papers.filter((p) => getSubjectDisplay(p) === activeSubject);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.paperCode.toLowerCase().includes(q) ||
          (p.paperName ?? "").toLowerCase().includes(q) ||
          getSubjectDisplay(p).toLowerCase().includes(q),
      );
    }
    return list;
  }, [papers, activeSubject, search]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-6 py-8 shadow-xl shadow-primary/20 sm:px-10">
        {/* decorative circles */}
        <span className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-8 right-24 h-32 w-32 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Academic Resources</p>
            <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Syllabus Library</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Browse curriculum, view structured syllabus data, and download original department PDFs.
            </p>

            {/* Quick stats */}
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                {syllabi.length} PDF{syllabi.length !== 1 ? "s" : ""} uploaded
              </span>
              {!loading && !error && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  {papers.length} paper{papers.length !== 1 ? "s" : ""} in catalog
                </span>
              )}
            </div>
          </div>

          <Link
            href="/upload?type=dept-syllabus"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-bold text-primary shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Syllabus
          </Link>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center gap-1 rounded-2xl bg-surface-container-low p-1 ring-1 ring-outline-variant/20">
        {(["catalog", "pdfs"] as const).map((tab) => {
          const label = tab === "catalog" ? "Syllabus Catalog" : `PDF Library${syllabi.length > 0 ? ` (${syllabi.length})` : ""}`;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150",
                activeTab === tab
                  ? "bg-surface text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── PDF Library Tab ──────────────────────────────────────────── */}
      {activeTab === "pdfs" && (
        <div className="mt-6 space-y-5">
          {/* Filter pills */}
          {syllabi.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(["all", "dept", "sem"] as const).map((f) => {
                const label =
                  f === "all" ? `All (${syllabi.length})` :
                  f === "dept" ? `Departmental (${deptSyllabi.length})` :
                  `Semester-wise (${semSyllabi.length})`;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPdfFilter(f)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition shadow-sm",
                      pdfFilter === f
                        ? "bg-primary text-on-primary shadow-md shadow-primary/30"
                        : "bg-surface-container text-on-surface hover:bg-surface-container-high",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {filteredSyllabi.length === 0 ? (
            <div className="rounded-3xl border border-outline-variant/30 bg-surface p-10 text-center">
              <svg className="mx-auto h-12 w-12 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="mt-4 text-sm text-on-surface-variant">No approved syllabus PDFs yet.</p>
              <Link href="/upload?type=dept-syllabus" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                Upload a department syllabus →
              </Link>
            </div>
          ) : (
            <>
              {/* Departmental section */}
              {(pdfFilter === "all" || pdfFilter === "dept") && deptSyllabi.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">DEPT</span>
                    <h2 className="text-sm font-semibold text-on-surface">Departmental Syllabi</h2>
                    <span className="ml-auto text-xs text-on-surface-variant">{deptSyllabi.length} file{deptSyllabi.length !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="mb-3 text-xs text-on-surface-variant">Full programme syllabi covering all semesters.</p>
                  <div className="grid gap-4" style={PDF_GRID_STYLE}>
                    {deptSyllabi.map((s) => (
                      <div key={s.id} className="relative">
                        <SyllabusPdfCard s={s} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Semester section */}
              {(pdfFilter === "all" || pdfFilter === "sem") && semSyllabi.length > 0 && (
                <div className={pdfFilter === "all" && deptSyllabi.length > 0 ? "mt-6" : ""}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">SEM</span>
                    <h2 className="text-sm font-semibold text-on-surface">Semester Syllabi</h2>
                    <span className="ml-auto text-xs text-on-surface-variant">{semSyllabi.length} file{semSyllabi.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid gap-4" style={PDF_GRID_STYLE}>
                    {semSyllabi.map((s) => (
                      <div key={s.id} className="relative">
                        <SyllabusPdfCard s={s} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Syllabus Catalog Tab ──────────────────────────────────────── */}
      {activeTab === "catalog" && (
        <div className="mt-6 space-y-5">
          {/* Search + filter bar */}
          {!loading && !error && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  placeholder="Search by code, name, or subject…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface py-2 pl-8 pr-4 text-sm text-on-surface placeholder-on-surface-variant/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Result count */}
              <span className="shrink-0 text-xs text-on-surface-variant">
                {filteredPapers.length} result{filteredPapers.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Subject filter chips */}
          {!loading && !error && subjectFilters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {subjectFilters.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setActiveSubject(sub)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition shadow-sm",
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

          {/* Content */}
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
              Loading syllabus library…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="rounded-3xl border border-outline-variant/30 bg-surface p-10 text-center text-sm text-on-surface-variant">
              {search ? `No papers match "${search}".` : "No syllabus entries found."}
            </div>
          ) : (
            <div className="grid gap-4" style={PAPER_GRID_STYLE}>
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
      )}
    </section>
  );
}


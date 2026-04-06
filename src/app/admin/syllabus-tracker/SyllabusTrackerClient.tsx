"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CurriculumPaper {
  code: string;
  name: string | null;
  semester: number;
  type: string;
  variant: "T" | "P" | string;
  credits: number;
  elective?: string;
}

export interface CurriculumTable {
  id: string;
  label: string;
  papers: CurriculumPaper[];
}

interface Props {
  tables: CurriculumTable[];
  /** Map of paper_code → paper_name (or null) from Syllabus_Table. */
  uploadedMap: Record<string, string | null>;
  totalExpected: number;
}

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const TYPE_COLORS: Record<string, string> = {
  DSC: "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700",
  DSM: "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700",
  IDC: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700",
  SEC: "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700",
  AEC: "bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700",
  VAC: "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700",
};

const TYPE_BADGE: Record<string, string> = {
  DSC: "bg-blue-100 text-blue-800",
  DSM: "bg-purple-100 text-purple-800",
  IDC: "bg-amber-100 text-amber-800",
  SEC: "bg-teal-100 text-teal-800",
  AEC: "bg-pink-100 text-pink-800",
  VAC: "bg-orange-100 text-orange-800",
};

function PaperCell({
  paper,
  isUploaded,
  name,
  isHighlighted,
  cellRef,
}: {
  paper: CurriculumPaper;
  isUploaded: boolean;
  name: string | null;
  isHighlighted: boolean;
  cellRef?: React.Ref<HTMLDivElement>;
}) {
  const baseClass = isUploaded
    ? "border border-green-300 bg-green-50 dark:bg-green-900/30 dark:border-green-700"
    : "border border-outline-variant/30 bg-surface-container-low";
  const highlightRing = isHighlighted
    ? "ring-2 ring-primary ring-offset-1 animate-pulse"
    : "";

  return (
    <div
      ref={cellRef}
      className={`rounded-lg p-2 text-xs transition-all ${baseClass} ${highlightRing} ${TYPE_COLORS[paper.type] ?? ""}`}
      title={name ?? paper.code}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono font-semibold leading-tight break-all">{paper.code}</span>
        <span
          className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none ${
            TYPE_BADGE[paper.type] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {paper.type}
        </span>
      </div>
      {name ? (
        <p className="mt-1 leading-tight text-on-surface line-clamp-2">{name}</p>
      ) : (
        <p className="mt-1 leading-tight text-on-surface-variant/60 italic">—</p>
      )}
      <div className="mt-1 flex items-center gap-1">
        <span
          className={`inline-block size-2 rounded-full ${isUploaded ? "bg-green-500" : "bg-gray-300"}`}
        />
        <span className={isUploaded ? "text-green-700 dark:text-green-400" : "text-on-surface-variant/60"}>
          {isUploaded ? "Uploaded" : "Pending"}
        </span>
        <span className="ml-auto text-on-surface-variant/50">
          {paper.variant === "P" ? "Lab" : `${paper.credits}cr`}
        </span>
      </div>
    </div>
  );
}

export default function SyllabusTrackerClient({ tables, uploadedMap, totalExpected }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightCode = searchParams.get("highlight")?.toUpperCase() ?? null;
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<string>(tables[0]?.id ?? "");

  // Switch to the tab containing the highlighted paper and scroll to it.
  useEffect(() => {
    if (!highlightCode) return;
    for (const table of tables) {
      if (table.papers.some((p) => p.code === highlightCode)) {
        setActiveTab(table.id);
        break;
      }
    }
  }, [highlightCode, tables]);

  useEffect(() => {
    if (highlightCode && highlightRef.current) {
      const id = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return () => clearTimeout(id);
    }
  }, [highlightCode, activeTab]);

  const clearHighlight = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("highlight");
    router.replace(url.pathname + url.search);
  }, [router]);

  const uploadedCount = Object.keys(uploadedMap).length;
  const activeTable = tables.find((t) => t.id === activeTab);

  // Group papers in the active table by semester
  const bySemester: Record<number, CurriculumPaper[]> = {};
  if (activeTable) {
    for (const paper of activeTable.papers) {
      if (!bySemester[paper.semester]) bySemester[paper.semester] = [];
      bySemester[paper.semester].push(paper);
    }
  }

  const tableUploadedCount = activeTable
    ? activeTable.papers.filter((p) => p.code in uploadedMap).length
    : 0;
  const tableTotal = activeTable?.papers.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Global progress bar ─────────────────────────────────── */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Overall Progress —{" "}
              <span className="text-primary">
                {uploadedCount} / {totalExpected}
              </span>{" "}
              papers uploaded
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {Math.round((uploadedCount / totalExpected) * 100)}% complete across all departments
            </p>
          </div>
          <a
            href="/admin/ingest-md"
            className="btn text-sm"
          >
            ↑ Ingest Syllabus
          </a>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, (uploadedCount / totalExpected) * 100)}%` }}
          />
        </div>
      </div>

      {/* ── Highlight banner ─────────────────────────────────────── */}
      {highlightCode && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-primary">✦</span>
          <span>
            Showing <strong className="font-mono">{highlightCode}</strong> — scroll down to see the
            highlighted cell.
          </span>
          <button
            onClick={clearHighlight}
            className="ml-auto text-xs text-on-surface-variant hover:text-on-surface"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Department / table tabs ───────────────────────────────── */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface shadow-sm">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 border-b border-outline-variant/30 p-3">
          {tables.map((table) => {
            const uploaded = table.papers.filter((p) => p.code in uploadedMap).length;
            const pct = table.papers.length > 0 ? Math.round((uploaded / table.papers.length) * 100) : 0;
            const isActive = activeTab === table.id;
            return (
              <button
                key={table.id}
                onClick={() => setActiveTab(table.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                }`}
              >
                {table.id}
                <span
                  className={`ml-1.5 text-xs ${isActive ? "text-on-primary/70" : "text-on-surface-variant"}`}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Active table content */}
        {activeTable && (
          <div className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">{activeTable.label}</h2>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs text-on-surface-variant">
                {tableUploadedCount} / {tableTotal} uploaded
              </span>
            </div>

            {/* Semester sections */}
            <div className="space-y-6">
              {SEMESTERS.map((sem) => {
                const papers = bySemester[sem];
                if (!papers || papers.length === 0) return null;
                const semUploaded = papers.filter((p) => p.code in uploadedMap).length;
                return (
                  <div key={sem}>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-on-surface-variant">
                        Semester {sem}
                      </h3>
                      <span className="h-px flex-1 bg-outline-variant/30" />
                      <span className="text-xs text-on-surface-variant">
                        {semUploaded}/{papers.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {papers.map((paper) => {
                        const isUploaded = paper.code in uploadedMap;
                        const name = uploadedMap[paper.code] ?? paper.name;
                        const isHighlighted = paper.code === highlightCode;
                        return (
                          <PaperCell
                            key={paper.code}
                            paper={paper}
                            isUploaded={isUploaded}
                            name={name}
                            isHighlighted={isHighlighted}
                            cellRef={isHighlighted ? highlightRef : undefined}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-green-500" /> Uploaded
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-gray-300" /> Pending
        </div>
        {Object.entries(TYPE_BADGE).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1">
            <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${cls}`}>{type}</span>
            <span>
              {type === "DSC" && "Core"}
              {type === "DSM" && "Minor"}
              {type === "IDC" && "Interdisciplinary"}
              {type === "SEC" && "Skill Enh."}
              {type === "AEC" && "Ability Enh."}
              {type === "VAC" && "Value Added"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

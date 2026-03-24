"use client";

import Link from "next/link";
import type { Paper } from "@/types";
import { toRoman } from "@/lib/utils";
import { makeAccentGradient } from "@/lib/gradients";

interface PaperCardProps {
  paper: Paper;
}

/** Category badge colours — shared with browse filters. */
export const PAPER_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  // FYUGP
  DSC: { bg: "#dbeafe", text: "#1d4ed8" },
  DSM: { bg: "#dcfce7", text: "#166534" },
  IDC: { bg: "#f3e8ff", text: "#7e22ce" },
  GE:  { bg: "#ffe4e6", text: "#9f1239" },
  AEC: { bg: "#fff7ed", text: "#c2410c" },
  VAC: { bg: "#f0fdfa", text: "#0f766e" },
  // CBCS
  HCC: { bg: "#fce7f3", text: "#9d174d" },
  DSE: { bg: "#ffedd5", text: "#9a3412" },
  GEC: { bg: "#ecfdf5", text: "#065f46" },
  // shared
  SEC: { bg: "#fef9c3", text: "#854d0e" },
};
function subjectColor(department: string): string {
  const d = department.toLowerCase();
  if (d.includes("physics")) return "#2563eb";
  if (d.includes("math") || d.includes("maths")) return "#7c3aed";
  if (d.includes("chem")) return "#059669";
  if (d.includes("bio")) return "#16a34a";
  if (d.includes("comp") || d.includes("cs") || d.includes("it")) return "#0891b2";
  if (d.includes("hist") || d.includes("arts")) return "#b45309";
  if (d.includes("eng") || d.includes("lit")) return "#db2777";
  if (d.includes("econ") || d.includes("commerce")) return "#d97706";
  if (d.includes("geo")) return "#0d9488";
  if (d.includes("elec") || d.includes("electrical")) return "#f59e0b";
  if (d.includes("mech")) return "#6366f1";
  if (d.includes("civil")) return "#64748b";
  return "var(--color-text-muted)";
}


export default function PaperCard({ paper }: PaperCardProps) {
  const accent = subjectColor(paper.department);
  const semNum = paper.semester ? parseInt(paper.semester, 10) : NaN;
  const semRoman = !isNaN(semNum) && semNum >= 1 ? toRoman(semNum) : paper.semester;
  const typeColors = paper.paper_type ? PAPER_TYPE_COLORS[paper.paper_type] : undefined;

  const uploaderDisplay = paper.uploaded_by_username ? `@${paper.uploaded_by_username}` : null;
  const courseLabel = paper.course_code || paper.course_name;

  const topGradient = makeAccentGradient(accent, typeColors?.text);

  return (
    <Link
      href={`/paper/${paper.id}`}
      className="group block overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface shadow-lift ring-1 ring-surface-container-high/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ambient focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      style={{ textDecoration: "none" }}
    >
      <div className="h-1 w-full" style={{ background: topGradient }} aria-hidden="true" />

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {paper.paper_type && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={
                  typeColors
                    ? { background: typeColors.bg, color: typeColors.text }
                    : { background: "var(--color-border)", color: "var(--color-text-muted)" }
                }
              >
                {paper.paper_type}
              </span>
            )}
            {paper.exam_type && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {paper.exam_type}
              </span>
            )}
            {paper.programme && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface">
                {paper.programme}
              </span>
            )}
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-sm font-semibold text-primary ring-1 ring-outline-variant/40">
            {paper.year ?? "PDF"}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold leading-snug text-on-surface line-clamp-2">{paper.title}</h3>
          {courseLabel && (
            <p className="text-sm text-on-surface-variant line-clamp-1">
              {paper.course_code ? paper.course_code : null}
              {paper.course_name && paper.course_name !== paper.title ? <> · {paper.course_name}</> : null}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {paper.department && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: "var(--color-border)", color: accent }}
            >
              {paper.department}
            </span>
          )}
          {semRoman && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
              Sem {semRoman}
            </span>
          )}
          {paper.institution && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
              {paper.institution}
            </span>
          )}
          {paper.marks != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
              {paper.marks} marks
            </span>
          )}
          {paper.duration != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-on-surface-variant">
              {paper.duration} mins
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-3">
            {uploaderDisplay && (
              <span className="inline-flex items-center gap-1 truncate max-w-[120px]" title={uploaderDisplay}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z" /><path d="M3 21c0-3.866 3.134-7 7-7h4c3.866 0 7 3.134 7 7" />
                </svg>
                {uploaderDisplay}
              </span>
            )}
            {paper.view_count !== undefined && paper.view_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {paper.view_count}
              </span>
            )}
            {paper.download_count !== undefined && paper.download_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                </svg>
                {paper.download_count}
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform duration-150 group-hover:translate-x-0.5">
            Open PDF
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

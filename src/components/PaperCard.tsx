"use client";

import Link from "next/link";
import type { Paper } from "@/types";
import { toRoman } from "@/lib/utils";
import { makeAccentGradient } from "@/lib/gradients";

interface PaperCardProps {
  paper: Paper;
}

/** Category badge colours — maps paper_type to theme-aware CSS variable colours. */
export const PAPER_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  // FYUGP
  DSC: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
  DSM: { bg: "rgba(16,185,129,0.12)", text: "#047857" },
  IDC: { bg: "rgba(139,92,246,0.12)", text: "#6d28d9" },
  GE:  { bg: "rgba(239,68,68,0.12)",  text: "#be123c" },
  AEC: { bg: "rgba(245,158,11,0.12)", text: "#b45309" },
  VAC: { bg: "rgba(16,185,129,0.10)", text: "#065f46" },
  // CBCS
  HCC: { bg: "rgba(236,72,153,0.12)", text: "#9d174d" },
  DSE: { bg: "rgba(249,115,22,0.12)", text: "#9a3412" },
  GEC: { bg: "rgba(16,185,129,0.10)", text: "#065f46" },
  // shared
  SEC: { bg: "rgba(234,179,8,0.12)",  text: "#854d0e" },
};

function subjectColor(department: string): string {
  const d = department.toLowerCase();
  if (d.includes("physics"))                          return "#2563eb";
  if (d.includes("math") || d.includes("maths"))     return "#7c3aed";
  if (d.includes("chem"))                             return "#059669";
  if (d.includes("bio"))                              return "#16a34a";
  if (d.includes("comp") || d.includes("cs") || d.includes("it")) return "#0891b2";
  if (d.includes("hist") || d.includes("arts"))      return "#b45309";
  if (d.includes("eng") || d.includes("lit"))        return "#db2777";
  if (d.includes("econ") || d.includes("commerce"))  return "#d97706";
  if (d.includes("geo"))                              return "#0d9488";
  if (d.includes("elec") || d.includes("electrical")) return "#f59e0b";
  if (d.includes("mech"))                             return "#6366f1";
  if (d.includes("civil"))                            return "#64748b";
  return "var(--color-primary)";
}

/** Resolve a download URL: prefer the Appwrite proxy route when file_id exists,
 *  otherwise fall back to the raw file_url with a ?download=1 hint. */
function resolveDownloadUrl(paper: Paper): string {
  if (paper.file_id) {
    return `/api/files/papers/${encodeURIComponent(paper.file_id)}?download=1`;
  }
  const url = paper.file_url ?? "";
  if (!url) return "#";
  // Append download hint if it's a relative URL
  try {
    const u = new URL(url, "https://x");
    u.searchParams.set("download", "1");
    return url.startsWith("http") ? u.toString() : u.pathname + u.search;
  } catch {
    return url;
  }
}

export default function PaperCard({ paper }: PaperCardProps) {
  const accent = subjectColor(paper.department);
  const semNum = paper.semester ? parseInt(paper.semester, 10) : NaN;
  const semRoman = !isNaN(semNum) && semNum >= 1 ? toRoman(semNum) : paper.semester;
  const typeColors = paper.paper_type ? PAPER_TYPE_COLORS[paper.paper_type] : undefined;

  const uploaderDisplay = paper.uploaded_by_username ? `@${paper.uploaded_by_username}` : null;
  const courseLabel = paper.course_code || paper.course_name;

  const topGradient = makeAccentGradient(accent, typeColors?.text);
  const downloadUrl = resolveDownloadUrl(paper);

  return (
    <Link
      href={`/paper/${paper.id}`}
      className="group block overflow-hidden rounded-3xl border border-outline-variant/20 bg-surface shadow-lift transition-all duration-200 hover:-translate-y-1 hover:shadow-ambient focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      style={{ textDecoration: "none" }}
    >
      {/* Coloured accent bar */}
      <div className="h-1 w-full" style={{ background: topGradient }} aria-hidden="true" />

      <div className="flex flex-col gap-3 p-4 sm:p-5">
        {/* ── Row 1: badges + year chip ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {paper.paper_type && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide"
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
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "rgba(16,185,129,0.10)", color: "var(--brand-emerald-dark)" }}
              >
                {paper.exam_type}
              </span>
            )}
            {paper.programme && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
              >
                {paper.programme}
              </span>
            )}
          </div>

          {/* Year pill */}
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ring-1"
            style={{
              background: "var(--brand-emerald-soft)",
              color: "var(--brand-emerald-dark)",
              ringColor: "rgba(16,185,129,0.20)",
            }}
          >
            {paper.year > 0 ? paper.year : "PDF"}
          </div>
        </div>

        {/* ── Row 2: title + course code ── */}
        <div className="space-y-0.5">
          <h3 className="text-base font-bold leading-snug text-on-surface line-clamp-2">
            {paper.title}
          </h3>
          {courseLabel && (
            <p className="text-[12px] font-medium text-on-surface-variant line-clamp-1 opacity-70">
              {paper.course_code ?? ""}
              {paper.course_name && paper.course_name !== paper.title ? (
                paper.course_code ? <> · {paper.course_name}</> : <>{paper.course_name}</>
              ) : null}
            </p>
          )}
        </div>

        {/* ── Row 3: department / semester / institute chips ── */}
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
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              Sem {semRoman}
            </span>
          )}
          {paper.institute && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {paper.institute}
            </span>
          )}
          {paper.marks != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {paper.marks} marks
            </span>
          )}
          {paper.duration != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {paper.duration} mins
            </span>
          )}
        </div>

        {/* ── Row 4: uploader / stats + action buttons ── */}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 pt-3">
          {/* Left: uploader + stats */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-on-surface-variant opacity-60">
            {uploaderDisplay && (
              <span className="inline-flex items-center gap-1 truncate max-w-[110px]" title={uploaderDisplay}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z" />
                  <path d="M3 21c0-3.866 3.134-7 7-7h4c3.866 0 7 3.134 7 7" />
                </svg>
                {uploaderDisplay}
              </span>
            )}
            {(paper.view_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {paper.view_count}
              </span>
            )}
            {(paper.download_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                </svg>
                {paper.download_count}
              </span>
            )}
          </div>

          {/* Right: Open + Download buttons */}
          <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
            {/* Download button — stops propagation so card Link doesn't fire */}
            <a
              href={downloadUrl}
              download
              title="Download PDF"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 hover:opacity-80"
              style={{
                background: "var(--color-border)",
                color: "var(--color-text-muted)",
              }}
              aria-label="Download PDF"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
              </svg>
              Download
            </a>

            {/* Open PDF button */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all group-hover:translate-x-0.5"
              style={{
                background: "var(--brand-emerald-soft)",
                color: "var(--brand-emerald-dark)",
              }}
            >
              Open PDF
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

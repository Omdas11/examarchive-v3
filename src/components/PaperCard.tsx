import Link from "next/link";
import type { Paper } from "@/types";
import { toRoman } from "@/lib/utils";

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
  const semRoman = paper.semester ? toRoman(parseInt(paper.semester, 10)) : paper.semester;

  const metaLine = [
    paper.institution,
    paper.programme,
    paper.department,
    semRoman ? `Sem ${semRoman}` : null,
    paper.year && String(paper.year),
  ].filter(Boolean).join(" · ");

  const uploaderDisplay = paper.uploaded_by_username
    ? `@${paper.uploaded_by_username}`
    : null;

  return (
    <Link
      href={`/paper/${paper.id}`}
      className="card group flex overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ textDecoration: "none" }}
    >
      {/* Vertical accent bar on the left */}
      <div
        className="w-1 shrink-0 rounded-l-lg"
        style={{ background: accent }}
        aria-hidden="true"
      />

      {/* Card content */}
      <div className="flex-1 min-w-0 p-4">
        {/* Title + code */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{paper.title}</h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {paper.course_code}
            {paper.course_name && paper.course_name !== paper.title && (
              <> · {paper.course_name}</>
            )}
          </p>
        </div>

        {/* Exam type badge + department tag */}
        <div className="mt-2 flex flex-wrap gap-1">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "var(--color-border)", color: accent }}
          >
            {paper.department}
          </span>
          {paper.exam_type && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {paper.exam_type}
            </span>
          )}
          {paper.paper_type && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={
                PAPER_TYPE_COLORS[paper.paper_type]
                  ? { background: PAPER_TYPE_COLORS[paper.paper_type].bg, color: PAPER_TYPE_COLORS[paper.paper_type].text }
                  : { background: "var(--color-border)", color: "var(--color-text-muted)" }
              }
            >
              {paper.paper_type}
            </span>
          )}
          {paper.semester && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              Sem {semRoman}
            </span>
          )}
          {paper.year && (
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
            >
              {paper.year}
            </span>
          )}
        </div>

        {/* Meta row: university + programme */}
        {metaLine && (
          <p className="mt-2 text-[11px] line-clamp-1" style={{ color: "var(--color-text-muted)" }}>
            {metaLine}
          </p>
        )}

        {/* Footer: uploader + stats + link indicator */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {uploaderDisplay && (
              <span className="truncate max-w-[90px]" title={uploaderDisplay}>
                {uploaderDisplay}
              </span>
            )}
            {(paper.view_count !== undefined && paper.view_count > 0) && (
              <span className="inline-flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {paper.view_count}
              </span>
            )}
            {(paper.download_count !== undefined && paper.download_count > 0) && (
              <span className="inline-flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
                </svg>
                {paper.download_count}
              </span>
            )}
          </div>

          <span
            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
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


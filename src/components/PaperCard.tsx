import Link from "next/link";
import type { Paper } from "@/types";

interface PaperCardProps {
  paper: Paper;
}

/** Returns a subtle subject-based accent color for the department/stream. */
function subjectColor(department: string): string {
  const d = department.toLowerCase();
  if (d.includes("physics")) return "#2563eb";       // blue
  if (d.includes("math") || d.includes("maths")) return "#7c3aed"; // purple
  if (d.includes("chem")) return "#059669";           // emerald
  if (d.includes("bio")) return "#16a34a";            // green
  if (d.includes("comp") || d.includes("cs") || d.includes("it")) return "#0891b2"; // cyan
  if (d.includes("hist") || d.includes("arts")) return "#b45309";   // amber
  if (d.includes("eng") || d.includes("lit")) return "#db2777";     // pink
  if (d.includes("econ") || d.includes("commerce")) return "#d97706"; // orange
  if (d.includes("geo")) return "#0d9488";            // teal
  if (d.includes("elec") || d.includes("electrical")) return "#f59e0b"; // yellow
  if (d.includes("mech")) return "#6366f1";           // indigo
  if (d.includes("civil")) return "#64748b";          // slate
  return "var(--color-text-muted)";
}

export default function PaperCard({ paper }: PaperCardProps) {
  const metaTags = [
    paper.year && String(paper.year),
    paper.semester,
    paper.exam_type,
    paper.stream,
    paper.marks ? `${paper.marks} marks` : null,
    paper.duration ? `${paper.duration} min` : null,
  ].filter(Boolean) as string[];

  const accent = subjectColor(paper.department);

  return (
    <div className="card group p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      {/* Subject color bar */}
      <div
        className="mb-3 h-0.5 w-8 rounded-full"
        style={{ background: accent }}
        aria-hidden="true"
      />

      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug line-clamp-2">{paper.title}</h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {paper.course_code}
          {paper.course_name && paper.course_name !== paper.title && (
            <> · {paper.course_name}</>
          )}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: "var(--color-border)", color: accent }}
        >
          {paper.department}
        </span>
        {metaTags.map((tag) => (
          <span
            key={tag}
            className="inline-block rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {paper.institution && (
        <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
          </svg>
          {paper.institution}
        </p>
      )}

      <Link
        href={`/paper/${paper.id}`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium transition-colors"
        style={{ color: "var(--color-primary)" }}
      >
        Open PDF
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}


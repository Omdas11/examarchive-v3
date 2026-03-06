import Link from "next/link";
import type { Paper } from "@/types";

interface PaperCardProps {
  paper: Paper;
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

  return (
    <div className="card group p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight truncate">{paper.title}</h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {paper.course_code}
            {/* Only show course_name if it differs from the card title to avoid redundancy */}
            {paper.course_name && paper.course_name !== paper.title && (
              <> · {paper.course_name}</>
            )}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
        >
          {paper.department}
        </span>
        {metaTags.map((tag) => (
          <span
            key={tag}
            className="inline-block rounded-full px-2 py-0.5 text-xs"
            style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      {paper.institution && (
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          🏫 {paper.institution}
        </p>
      )}

      <Link
        href={`/paper/${paper.id}`}
        className="mt-3 inline-block text-sm font-medium transition-colors"
        style={{ color: "var(--color-primary)" }}
      >
        Open PDF →
      </Link>
    </div>
  );
}

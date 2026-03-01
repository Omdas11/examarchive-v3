import Link from "next/link";
import type { Paper } from "@/types";

interface PaperCardProps {
  paper: Paper;
}

export default function PaperCard({ paper }: PaperCardProps) {
  return (
    <div className="card group p-4 transition-shadow hover:shadow-md">
      <h3 className="text-base font-semibold">{paper.title}</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {paper.course_code}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span>{paper.year}</span>
        <span>·</span>
        <span>{paper.semester}</span>
        <span>·</span>
        <span>{paper.department}</span>
      </div>
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

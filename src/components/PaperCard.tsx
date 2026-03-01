import Link from "next/link";
import type { Paper } from "@/types";

interface PaperCardProps {
  paper: Paper;
}

export default function PaperCard({ paper }: PaperCardProps) {
  return (
    <Link
      href={`/paper/${paper.id}`}
      className="group block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
      <h3 className="text-base font-semibold group-hover:text-blue-600 transition-colors">
        {paper.title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {paper.course_code} &middot; {paper.course_name}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
        <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
          {paper.year}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
          {paper.semester}
        </span>
        <span className="rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
          {paper.exam_type}
        </span>
      </div>
    </Link>
  );
}

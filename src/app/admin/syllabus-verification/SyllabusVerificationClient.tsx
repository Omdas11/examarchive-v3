"use client";

import { useState } from "react";
import { type SyllabusTableRow } from "@/lib/syllabus-table";
import { publishSyllabusRow, deleteSyllabusRow } from "./actions";
import { Check, Trash2, ChevronDown, ChevronUp, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function SyllabusVerificationClient({
  initialRows,
}: {
  initialRows: SyllabusTableRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handlePublish = async (id: string) => {
    const res = await publishSyllabusRow(id);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert("Failed to publish: " + res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to reject and delete this submission?")) return;
    const res = await deleteSyllabusRow(id);
    if (res.success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      alert("Failed to delete: " + res.error);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-12 text-center border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <Check className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">All Caught Up!</h3>
        <p className="text-neutral-500 mt-2">There are no pending syllabus submissions to review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {rows.map((row) => (
        <div
          key={row.id}
          className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden"
        >
          <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  Pending
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-wider">
                  {row.paper_code}
                </span>
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{row.paper_name}</h2>
              <p className="text-sm text-neutral-500">
                {row.university} • {row.stream} • {row.course} • Unit {row.unit_number}
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                className="flex-1 md:flex-none px-4 py-2 text-sm font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {expanded === row.id ? "Hide Content" : "Review Content"}
                {expanded === row.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleDelete(row.id)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                title="Reject and Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePublish(row.id)}
                className="px-6 py-2 text-sm font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors shadow-sm shadow-green-500/20"
              >
                Publish Live
              </button>
            </div>
          </div>
          
          {expanded === row.id && (
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{row.syllabus_content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Syllabus } from "@/types";
import { toRoman } from "@/lib/utils";

interface SyllabusModerationProps {
  syllabi: Syllabus[];
}

export default function SyllabusModeration({ syllabi }: SyllabusModerationProps) {
  const [items, setItems] = useState<Syllabus[]>(syllabi);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve-syllabus" | "reject-syllabus") {
    setLoading((prev) => ({ ...prev, [id]: action }));
    setError(null);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Action failed");
      }

      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 text-center card p-8">
        <svg
          className="mx-auto h-10 w-10 opacity-30 mb-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
          No syllabi pending approval.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--color-accent-soft)",
            color: "var(--color-primary)",
            border: "1px solid var(--color-primary)",
          }}
        >
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-x-auto rounded-lg sm:block" style={{ border: "1px solid var(--color-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
              {["University", "Programme", "Dept / Stream", "Subject", "Year", "Semester", "Uploaded by", "Date", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const semNum = parseInt(s.semester ?? "", 10);
              const semDisplay = !isNaN(semNum) ? `Sem ${toRoman(semNum)}` : s.semester;
              const uploaderDisplay = s.uploaded_by_username
                ? `@${s.uploaded_by_username}`
                : s.uploader_id
                  ? s.uploader_id.slice(0, 8) + "…"
                  : "—";
              const dateDisplay = s.created_at
                ? new Date(s.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                : "—";

              return (
                <tr
                  key={s.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td className="px-3 py-2.5 text-xs max-w-[140px] truncate" title={s.university}>{s.university || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">{s.programme || "—"}</td>
                  <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" title={s.department}>{s.department || "—"}</td>
                  <td className="px-3 py-2.5 text-xs font-medium max-w-[160px] truncate" title={s.subject}>{s.subject || "—"}</td>
                  <td className="px-3 py-2.5 text-xs">{s.year ?? "—"}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">{semDisplay || "—"}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>{uploaderDisplay}</td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>{dateDisplay}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAction(s.id, "approve-syllabus")}
                        disabled={!!loading[s.id]}
                        className="rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading[s.id] === "approve-syllabus" ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(s.id, "reject-syllabus")}
                        disabled={!!loading[s.id]}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
                        style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                      >
                        {loading[s.id] === "reject-syllabus" ? "…" : "Reject"}
                      </button>
                      {s.file_url && (
                        <a
                          href={s.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full px-3 py-1 text-[11px] font-semibold"
                          style={{ border: "1px solid var(--color-border)", color: "var(--color-primary)" }}
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="mt-4 space-y-3 sm:hidden">
        {items.map((s) => {
          const semNum = parseInt(s.semester ?? "", 10);
          const semDisplay = !isNaN(semNum) ? `Sem ${toRoman(semNum)}` : s.semester;
          const uploaderDisplay = s.uploaded_by_username
            ? `@${s.uploaded_by_username}`
            : s.uploader_id
              ? s.uploader_id.slice(0, 8) + "…"
              : "—";
          const dateDisplay = s.created_at
            ? new Date(s.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
            : "—";

          return (
            <li key={s.id} className="card p-4">
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{s.subject || s.course_name || "—"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {s.university}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {s.department && <span>{s.department}</span>}
                    {s.programme && <><span>·</span><span>{s.programme}</span></>}
                    {semDisplay && <><span>·</span><span>{semDisplay}</span></>}
                    {s.year && <><span>·</span><span>{s.year}</span></>}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {uploaderDisplay} · {dateDisplay}
                  </div>
                  {s.file_url && (
                    <a
                      href={s.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-xs font-medium"
                      style={{ color: "var(--color-primary)" }}
                    >
                      Preview PDF →
                    </a>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAction(s.id, "approve-syllabus")}
                    disabled={!!loading[s.id]}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading[s.id] === "approve-syllabus" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(s.id, "reject-syllabus")}
                    disabled={!!loading[s.id]}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                  >
                    {loading[s.id] === "reject-syllabus" ? "Rejecting…" : "Reject"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

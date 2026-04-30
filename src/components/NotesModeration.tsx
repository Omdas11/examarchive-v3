"use client";

import { useState } from "react";
import type { PendingNote } from "@/types";

interface NotesModerationProps {
  notes: PendingNote[];
}

export default function NotesModeration({ notes }: NotesModerationProps) {
  const [items, setItems] = useState<PendingNote[]>(notes);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve-note" | "reject-note") {
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

      setItems((prev) => prev.filter((n) => n.id !== id));
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
          No notes pending approval.
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
              {["Title / File", "Uploader ID", "Date", "Actions"].map((h) => (
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
            {items.map((note) => {
              const dateDisplay = note.created_at
                ? new Date(note.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
                : "—";

              return (
                <tr
                  key={note.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td className="px-3 py-2.5 text-xs font-medium max-w-[240px] truncate" title={note.title || note.file_name}>
                    {note.title || note.file_name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {note.user_id ? note.user_id.slice(0, 10) + "…" : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
                    {dateDisplay}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAction(note.id, "approve-note")}
                        disabled={!!loading[note.id]}
                        className="rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading[note.id] === "approve-note" ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(note.id, "reject-note")}
                        disabled={!!loading[note.id]}
                        className="rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50"
                        style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                      >
                        {loading[note.id] === "reject-note" ? "…" : "Reject"}
                      </button>
                      {note.preview_url && (
                        <a
                          href={note.preview_url}
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
        {items.map((note) => {
          const dateDisplay = note.created_at
            ? new Date(note.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })
            : "—";

          return (
            <li key={note.id} className="card p-4">
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{note.title || note.file_name || "—"}</p>
                  <div className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {note.user_id ? note.user_id.slice(0, 10) + "…" : "—"} · {dateDisplay}
                  </div>
                  {note.preview_url && (
                    <a
                      href={note.preview_url}
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
                    onClick={() => handleAction(note.id, "approve-note")}
                    disabled={!!loading[note.id]}
                    className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading[note.id] === "approve-note" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(note.id, "reject-note")}
                    disabled={!!loading[note.id]}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                  >
                    {loading[note.id] === "reject-note" ? "Rejecting…" : "Reject"}
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

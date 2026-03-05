"use client";

import { useState } from "react";
import type { Paper } from "@/types";

interface AdminActionsProps {
  papers: Paper[];
}

export default function AdminActions({ papers }: AdminActionsProps) {
  const [items, setItems] = useState<Paper[]>(papers);
  const [loading, setLoading] = useState<Record<string, string>>({});

  async function handleAction(id: string, action: "approve" | "delete") {
    setLoading((prev) => ({ ...prev, [id]: action }));

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Action failed");
      }

      // Remove from list on success
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
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
          No papers pending approval.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {items.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{p.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {p.course_code} · {p.course_name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span>{p.department}</span>
                <span>·</span>
                <span>{p.year}</span>
                <span>·</span>
                <span>{p.semester}</span>
                <span>·</span>
                <span>{p.exam_type}</span>
              </div>
              {p.file_url && (
                <a
                  href={p.file_url}
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
                onClick={() => handleAction(p.id, "approve")}
                disabled={!!loading[p.id]}
                className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading[p.id] === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleAction(p.id, "delete")}
                disabled={!!loading[p.id]}
                className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                {loading[p.id] === "delete" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

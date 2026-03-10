"use client";

import { useState } from "react";
import type { Paper } from "@/types";

interface AdminActionsProps {
  papers: Paper[];
}

export default function AdminActions({ papers }: AdminActionsProps) {
  const [items, setItems] = useState<Paper[]>(papers);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Track the previewed paper by ID, not URL, so the panel closes
  // automatically when the paper is approved or rejected.
  const [previewPaperId, setPreviewPaperId] = useState<string | null>(null);
  const previewPaper = items.find((p) => p.id === previewPaperId) ?? null;

  async function handleAction(id: string, action: "approve" | "delete") {
    setLoading((prev) => ({ ...prev, [id]: action }));
    setError(null);

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

      // Close preview if it's the paper being actioned.
      if (previewPaperId === id) setPreviewPaperId(null);
      // Remove from list on success.
      setItems((prev) => prev.filter((p) => p.id !== id));
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
          No papers pending approval.
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
      <ul className="mt-4 space-y-3">
      {items.map((p) => (
        <li key={p.id} className="card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{p.title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {p.course_code ? <>{p.course_code} · </> : null}{p.course_name}
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
                <button
                  type="button"
                  onClick={() => setPreviewPaperId(previewPaperId === p.id ? null : p.id)}
                  className="inline-block mt-2 text-xs font-medium cursor-pointer"
                  style={{ color: "var(--color-primary)", background: "none", border: "none", padding: 0 }}
                >
                  {previewPaperId === p.id ? "Close Preview ←" : "Preview PDF →"}
                </button>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleAction(p.id, "approve")}
                disabled={!!loading[p.id]}
                className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--success-green)" }}
              >
                {loading[p.id] === "approve" && <span className="btn-spinner" />}
                {loading[p.id] === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleAction(p.id, "delete")}
                disabled={!!loading[p.id]}
                className="rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
              >
                {loading[p.id] === "delete" && <span className="btn-spinner" />}
                {loading[p.id] === "delete" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>

      {/* Side-panel PDF previewer */}
      <div className={`pdf-side-panel${previewPaper ? " open" : ""}`}>
        <div className="pdf-side-panel-header">
          <span className="text-sm font-semibold">PDF Preview</span>
          <button
            type="button"
            onClick={() => setPreviewPaperId(null)}
            className="p-1 rounded hover:opacity-70"
            aria-label="Close preview"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {previewPaper?.file_url && (
          <iframe
            src={previewPaper.file_url}
            title="PDF Preview"
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </>
  );
}

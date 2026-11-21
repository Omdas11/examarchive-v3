"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  STATUS_LABELS,
  type MdVerificationItem,
} from "@/lib/md-verification";

/**
 * Side-by-side verification view. Large screens: PDF on the left, md on
 * the right. Phones: stacked, PDF first. The md pane has Edit (monospace
 * textarea) and Preview (rendered markdown) modes. Save draft stores the
 * edited md in D1 with a history row; the PDF is never modified. Submit
 * saves and marks the item in review; Approve / Needs fix record the
 * review decision with an optional note.
 */
export default function MdVerificationDetail({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<MdVerificationItem | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/md-verification/${itemId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load the item");
      const data = (await res.json()) as { item: MdVerificationItem };
      setItem(data.item);
      setDraft(data.item.md_text);
      setNote(data.item.note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the item");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(submit: boolean) {
    if (!item) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/md-verification/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ md_text: draft, note: note || undefined }),
      });
      const data = (await res.json()) as {
        item?: MdVerificationItem;
        error?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Save failed");
      }
      setItem(data.item);
      setSavedAt(
        submit ? "Submitted for review." : "Draft saved.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function review(action: "approve" | "needs_fix") {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/md-verification/${item.id}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = (await res.json()) as {
        item?: MdVerificationItem;
        xp_awarded?: number;
        credits_awarded?: number;
        error?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Review failed");
      }
      setItem(data.item);
      setSavedAt(
        action === "approve"
          ? data.xp_awarded && data.xp_awarded > 0
            ? `Approved. +${data.xp_awarded} XP and +${data.credits_awarded ?? 0} AI credits earned. This md is now the source of truth for AI Notes.`
            : "Approved. This md is now the source of truth for AI Notes."
          : "Sent back for fixes.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading…</p>;
  }
  if (error && !item) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/admin/md-verification"
          className="mt-4 inline-block text-sm underline"
        >
          Back to the queue
        </Link>
      </div>
    );
  }
  if (!item) return null;

  const dirty = draft !== item.md_text;

  return (
    <div>
      <Link
        href="/admin/md-verification"
        className="text-sm underline"
      >
        Back to the queue
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{item.paper_code}</h1>
        <span className="text-sm font-semibold">
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">
        {item.type === "question" ? "Question paper" : "Syllabus"}
        {" · "}Batch {item.batch_id}
        {" · "}Via {item.submitted_via === "upload" ? "AI upload" : "manual"}
        {item.verified_at
          ? ` · Verified ${new Date(item.verified_at).toLocaleString()}`
          : ""}
      </p>
      {item.note && (
        <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Note: {item.note}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-base font-bold">Official PDF</h2>
          {item.pdf_key ? (
            <iframe
              title={`PDF for ${item.paper_code}`}
              src={`/api/md-verification/${item.id}/pdf`}
              className="mt-3 h-[70vh] w-full border"
            />
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">
              No PDF was uploaded for this item yet.
            </p>
          )}
        </section>

        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">Markdown</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`border px-3 py-1 text-sm ${mode === "edit" ? "font-bold" : ""}`}
                aria-pressed={mode === "edit"}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`border px-3 py-1 text-sm ${mode === "preview" ? "font-bold" : ""}`}
                aria-pressed={mode === "preview"}
              >
                Preview
              </button>
            </div>
          </div>
          {mode === "edit" ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-3 h-[70vh] w-full border bg-white p-3 font-mono text-sm"
              aria-label="Markdown text"
              spellCheck={false}
            />
          ) : (
            <div className="prose mt-3 h-[70vh] max-w-none overflow-auto border p-3 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {draft}
              </ReactMarkdown>
            </div>
          )}
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">
              Note (shown to the next reviewer; required when sending back)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border bg-white px-3 py-2 text-sm"
              placeholder="e.g. Q3 marks are wrong in the md, PDF says 10"
            />
          </label>
          {dirty && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Unsaved changes.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {savedAt && <p className="mt-2 text-sm text-emerald-700">{savedAt}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving}
              className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => void review("approve")}
              disabled={saving}
              className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => void review("needs_fix")}
              disabled={saving || !note.trim()}
              className="border border-red-700 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
            >
              Needs fix
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

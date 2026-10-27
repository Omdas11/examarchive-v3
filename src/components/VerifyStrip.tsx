"use client";

import { useCallback, useEffect, useState } from "react";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";
import type { VerifyContentType } from "@/lib/verify";

interface VerifyState {
  mine: {
    verdict: string;
    xp_awarded: number;
    credits_awarded: number;
    status: string;
  } | null;
  total: number;
  correct: number;
  flagged: number;
}

/**
 * "Is this correct?" strip for AI content. Logged-out visitors never see
 * it (the state request 401s and the strip renders nothing). One row per
 * (user, content): re-verdicting updates the row but never pays twice.
 */
export default function VerifyStrip({
  contentType,
  contentId,
}: {
  contentType: VerifyContentType;
  contentId: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<VerifyState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [correction, setCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/verify?content_type=${encodeURIComponent(contentType)}&content_id=${encodeURIComponent(contentId)}`,
        { credentials: "include" },
      );
      if (res.status === 401) {
        setHidden(true);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as VerifyState;
      setState(data);
    } catch {
      // Non-critical — strip stays usable for a fresh verdict.
    } finally {
      setLoading(false);
    }
  }, [contentType, contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(verdict: "correct" | "flagged") {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          verdict,
          correction: verdict === "flagged" ? correction : "",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        already?: boolean;
        xp_awarded?: number;
        credits_awarded?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save verification");
      }
      if (data.already) {
        setNotice("Verdict updated. Rewards are paid once per item.");
      } else {
        const parts: string[] = [];
        if ((data.xp_awarded ?? 0) > 0) parts.push(`+${data.xp_awarded} XP`);
        if ((data.credits_awarded ?? 0) > 0) parts.push(`+${data.credits_awarded} credit`);
        let msg =
          parts.length > 0
            ? `Thanks! You earned ${parts.join(", ")}.`
            : "Thanks! Daily verification rewards reached — try again tomorrow.";
        if (verdict === "flagged") {
          msg += " Your correction is queued for moderator review (+25 XP, +5 credits on acceptance).";
        }
        setNotice(msg);
      }
      setShowForm(false);
      setCorrection("");
      dispatchProfileRefreshEvent();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save verification");
    } finally {
      setSubmitting(false);
    }
  }

  if (hidden) return null;

  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <p className="text-sm font-semibold">Is this content correct?</p>
      {state && state.total > 0 && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {state.correct} verified correct · {state.flagged} flagged
          {state.mine ? ` · Verified by you (${state.mine.verdict})` : ""}
        </p>
      )}
      {loading ? (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Loading…
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit("correct")}
            className="rounded-lg bg-surface-container px-3 py-2 text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Correct
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-surface-container px-3 py-2 text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Report error
          </button>
        </div>
      )}
      {showForm && (
        <div className="mt-3 space-y-2">
          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What is wrong, and what should it say?"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit("flagged")}
              className="rounded-lg bg-surface-container px-3 py-2 text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              Submit correction
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {notice}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";
import type { VerifyContentType } from "@/lib/verify";
import { IconCheck, IconWarning } from "@/components/Icons";

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
 *
 * On syllabus units the strip wraps the unit content and the verdict is
 * a swipe: swipe right = Correct, swipe left = Report. The buttons are
 * gone — one swipeable card per unit instead of five button pairs.
 * Keyboard: focus the card and press ArrowRight (correct) / ArrowLeft
 * (report). Pointer drag works for mouse as well as touch.
 */
export default function VerifyStrip({
  contentType,
  contentId,
  variant = "full",
  children,
}: {
  contentType: VerifyContentType;
  contentId: string;
  /** "compact" renders a one-row footer (~40px) instead of the full box —
   * same API, same XP/credit rewards. Used on syllabus units, where the
   * full box repeated per unit is ~3x taller than the content it verifies. */
  variant?: "full" | "compact";
  /** Unit content to wrap in the swipeable card (compact variant only). */
  children?: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<VerifyState | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [correction, setCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Swipe state (compact variant): horizontal drag offset in px, and the
  // swipe direction the card is leaning toward (for the tint + label).
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const cardRef = useRef<HTMLDivElement | null>(null);

  const SWIPE_THRESHOLD = 80;

  const handleSwipe = useCallback(
    (dx: number) => {
      if (submitting) return;
      if (dx >= SWIPE_THRESHOLD) {
        void submit("correct");
      } else if (dx <= -SWIPE_THRESHOLD) {
        setShowForm(true);
      }
    },
    // submit is stable enough per render; re-created when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting]
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (submitting) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, active: true };
    setDragging(true);
    cardRef.current?.setPointerCapture(e.pointerId);
  }, [submitting]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStartRef.current;
    if (!s.active) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    // Only follow horizontal drags; let vertical scrolling pass through.
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStartRef.current;
    if (!s.active) return;
    dragStartRef.current.active = false;
    setDragging(false);
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    setDragX(0);
    if (Math.abs(dx) > Math.abs(dy)) {
      handleSwipe(dx);
    }
  }, [handleSwipe]);

  const onPointerCancel = useCallback(() => {
    dragStartRef.current.active = false;
    setDragging(false);
    setDragX(0);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (submitting) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void submit("correct");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setShowForm(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitting]
  );

  const load = useCallback(async () => {
    // A hung /verify request must never leave the strip stuck on
    // "Loading…": the buttons are the useful part, the counts are not.
    // 10s abort, then the strip settles into its usable state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(
        `/api/verify?content_type=${encodeURIComponent(contentType)}&content_id=${encodeURIComponent(contentId)}`,
        { credentials: "include", signal: controller.signal },
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
      clearTimeout(timeout);
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

  // Guests (401 on /api/verify) never see the verify strip — but the
  // unit content is this component's children now, so hiding the whole
  // component would hide the units too. Render the content plainly
  // (no swipe, no footer) instead of returning null.
  if (hidden) {
    if (variant === "compact") {
      return <div>{children}</div>;
    }
    return null;
  }

  if (variant === "compact") {
    const counts =
      loading
        ? "Checking…"
        : state && state.total > 0
          ? `${state.correct} verified · ${state.flagged} flagged${state.mine ? ` · You: ${state.mine.verdict}` : ""}`
          : "Not verified yet · +10 XP for verifying";
    // Swipe tint: green while dragging right (correct), red while
    // dragging left (report). Fades back when released.
    const tint =
      dragX > 24
        ? "rgba(4, 120, 87, 0.10)"
        : dragX < -24
          ? "rgba(220, 38, 38, 0.08)"
          : "transparent";
    return (
      <div
        ref={cardRef}
        role="group"
        aria-label="Swipe right to mark correct, swipe left to report an error. Arrow keys work too."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        className="relative select-none overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        style={{
          background: tint,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease, background 0.2s ease",
          touchAction: "pan-y",
          cursor: submitting ? "default" : "grab",
        }}
      >
        {/* Swipe direction label — appears while dragging. */}
        {dragX > 40 && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
            Correct
          </span>
        )}
        {dragX < -40 && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white">
            Report
          </span>
        )}
        {children}
        <div
          className="border-t pt-2.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-2">
            <p
              className="min-w-0 flex-1 truncate text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {counts}
            </p>
            <span className="shrink-0 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Swipe right to verify · left to report
            </span>
          </div>
          {showForm && (
            <div className="mt-2.5 space-y-2">
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
      </div>
    );
  }

  return (
    <div
      className="mt-4 rounded-xl border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <p className="text-sm font-semibold">Is this content correct?</p>
      {loading ? (
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Loading…
        </p>
      ) : (
        state &&
        state.total > 0 && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {state.correct} verified correct · {state.flagged} flagged
            {state.mine ? ` · Verified by you (${state.mine.verdict})` : ""}
          </p>
        )
      )}
      {/* Buttons are always usable — only the counts line waits on the
          /api/verify fetch. A slow or failed fetch must never hide them. */}
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

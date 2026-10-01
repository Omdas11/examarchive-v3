"use client";

import { useEffect, useState } from "react";

/** Setup guide for the AI feature — see docs/AI_NOTES_SETUP.md in the repo. */
export const AI_SETUP_DOCS_URL =
  "https://github.com/Omdas11/examarchive-v3/blob/main/docs/AI_NOTES_SETUP.md";

/**
 * Graceful "AI notes unavailable — not configured" notice.
 *
 * Checks /api/ai/status on mount; when no Gemini/Google API key is configured
 * on the server it renders a friendly notice linking to the setup guide,
 * instead of letting users hit a raw 503 error from the generation endpoints.
 */
export default function AiNotConfiguredNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled && data && data.configured === false) setShow(true);
      })
      .catch(() => {
        // status check failed — stay silent rather than add noise
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-3xl border border-amber-500/25 bg-amber-50 p-5 text-amber-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:bg-amber-950/30 dark:text-amber-200"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-xl font-bold" aria-hidden="true">
          info
        </span>
        <div>
          <p className="font-bold text-sm">
            AI notes are unavailable — not configured yet
          </p>
          <p className="mt-1 text-sm opacity-80">
            The AI generation backend hasn&apos;t been set up on this deployment.
            Browsing papers and syllabi works normally; only AI features are paused.
          </p>
        </div>
      </div>
      <a
        href={AI_SETUP_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-amber-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-amber-700 active:scale-95"
      >
        AI setup guide
      </a>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("no window"));
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector(
    `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      const iv = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(iv);
          resolve();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(iv);
        reject(new Error("Turnstile script timed out"));
      }, 15000);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(s);
  });
}

interface CaptchaSyllabusDownloadButtonProps {
  paperCode?: string;
  subjectCode?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Download button for a generated syllabus PDF (single-paper or
 * departmental) with a Cloudflare Turnstile gate for EVERYONE
 * (logged-in or not). Every download runs one Turnstile check, after
 * which a short-lived signed PDF URL is issued server-side. The gate
 * applies to logged-in users too, so a bot with an account cannot
 * bulk-download and burn the Appwrite read budget. There is no
 * direct-link path. Turnstile is usually invisible — it runs in the
 * background and only shows a challenge when it looks suspicious.
 */
export default function CaptchaSyllabusDownloadButton({
  paperCode,
  subjectCode,
  className,
  children,
}: CaptchaSyllabusDownloadButtonProps) {
  const [showChallenge, setShowChallenge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const closeChallenge = useCallback(() => {
    setShowChallenge(false);
    setError(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    }
    widgetIdRef.current = null;
  }, []);

  const handleVerified = useCallback(
    async (turnstileToken: string) => {
      if (!paperCode && !subjectCode) {
        setError("This download has no paper attached.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/turnstile-syllabus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperCode, subjectCode, turnstileToken }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Verification failed. Please try again.");
        }
        closeChallenge();
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Something went wrong. Please try again.",
        );
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            /* ignore */
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [paperCode, subjectCode, closeChallenge],
  );

  useEffect(() => {
    if (!showChallenge || !widgetHostRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (
          cancelled ||
          !widgetHostRef.current ||
          !window.turnstile ||
          widgetIdRef.current
        )
          return;
        widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => handleVerified(token),
          "expired-callback": () => {
            widgetIdRef.current = null;
            setError("Check expired — please try again.");
          },
          "error-callback": () =>
            setError("Could not load the check. Please try again."),
        });
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load the check. Check your connection and try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [showChallenge, siteKey, handleVerified]);

  if (!paperCode && !subjectCode) {
    // Misconfigured: fall back to prompting sign-in rather than a dead button.
    return (
      <a href="/login" className={className}>
        {children}
      </a>
    );
  }

  if (!siteKey) {
    // Misconfigured: fall back to prompting sign-in rather than a dead button.
    return (
      <a href="/login" className={className}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setShowChallenge(true)} className={className} disabled={busy}>
        {children}
      </button>
      {showChallenge && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={closeChallenge}
          role="dialog"
          aria-modal="true"
          aria-label="Verify you are human to download"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold tracking-tight">One quick check</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {busy ? "Verifying…" : "Running a quick human check — your PDF will open right after."}
            </p>
            <div className="mt-4 flex justify-center">
              <div ref={widgetHostRef} />
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
            <button
              type="button"
              onClick={closeChallenge}
              className="mt-4 w-full rounded-full border border-neutral-300 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

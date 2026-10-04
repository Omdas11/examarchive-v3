"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const HCAPTCHA_SCRIPT_SRC = "https://js.hcaptcha.com/1/api.js?render=explicit";

function loadHCaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.hcaptcha) return Promise.resolve();
  const existing = document.querySelector(`script[src="${HCAPTCHA_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      const iv = window.setInterval(() => {
        if (window.hcaptcha) {
          window.clearInterval(iv);
          resolve();
        }
      }, 100);
      window.setTimeout(() => {
        window.clearInterval(iv);
        reject(new Error("hCaptcha script timed out"));
      }, 15000);
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HCAPTCHA_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("hCaptcha script failed to load"));
    document.head.appendChild(s);
  });
}

interface CaptchaDownloadButtonProps {
  fileId: string | undefined;
  fileUrl: string;
  isLoggedIn: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Download button with a CAPTCHA gate for anonymous visitors.
 * Logged-in users get a direct link; everyone else solves one hCaptcha
 * checkbox, after which a short-lived download URL is issued server-side.
 */
export default function CaptchaDownloadButton({
  fileId,
  fileUrl,
  isLoggedIn,
  className,
  children,
}: CaptchaDownloadButtonProps) {
  const [showChallenge, setShowChallenge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  const closeChallenge = useCallback(() => {
    setShowChallenge(false);
    setError(null);
    if (widgetIdRef.current && window.hcaptcha) {
      try {
        window.hcaptcha.reset(widgetIdRef.current);
      } catch {
        /* ignore */
      }
    }
    widgetIdRef.current = null;
  }, []);

  const handleVerified = useCallback(
    async (captchaToken: string) => {
      if (!fileId) {
        setError("This paper has no file attached.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/captcha-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId, captchaToken }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Verification failed. Please try again.");
        }
        closeChallenge();
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        if (widgetIdRef.current && window.hcaptcha) {
          try {
            window.hcaptcha.reset(widgetIdRef.current);
          } catch {
            /* ignore */
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [fileId, closeChallenge]
  );

  useEffect(() => {
    if (!showChallenge || !widgetHostRef.current) return;
    let cancelled = false;
    loadHCaptchaScript()
      .then(() => {
        if (cancelled || !widgetHostRef.current || !window.hcaptcha || widgetIdRef.current) return;
        widgetIdRef.current = window.hcaptcha.render(widgetHostRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => handleVerified(token),
          "expired-callback": () => {
            widgetIdRef.current = null;
            setError("Challenge expired — please try again.");
          },
          "error-callback": () => setError("Could not load the challenge. Please try again."),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the challenge. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [showChallenge, siteKey, handleVerified]);

  if (isLoggedIn) {
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }

  if (!siteKey || !fileId) {
    // Misconfigured or file-less paper: fall back to prompting sign-in
    // rather than rendering a dead button.
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
              {busy ? "Verifying…" : "Solve the checkbox below and your PDF will open."}
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

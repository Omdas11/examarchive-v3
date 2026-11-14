"use client";

import { useEffect, useRef, useState } from "react";

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

/**
 * Cloudflare Turnstile widget for a server-action form (login, signup,
 * magic link). Renders the widget and keeps the solved token in a hidden
 * `turnstileToken` input so the server action can verify it with
 * verifyTurnstileToken() before doing anything. If the token expires the
 * widget resets and the token is cleared, so a stale submit fails
 * server-side with a clear "complete the check" error instead of silently
 * passing. In managed mode Turnstile is usually invisible — it runs in the
 * background and only shows a challenge when it looks suspicious.
 */
export default function TurnstileField() {
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey || !widgetHostRef.current) return;
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
          callback: (t: string) => {
            setToken(t);
            setError(null);
          },
          "expired-callback": () => {
            setToken("");
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
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div>
      <input type="hidden" name="turnstileToken" value={token} />
      <div className="flex justify-center">
        <div ref={widgetHostRef} />
      </div>
      {error && (
        <p className="mt-2 text-center text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

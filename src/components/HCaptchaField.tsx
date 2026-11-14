"use client";

import { useEffect, useRef, useState } from "react";

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

/**
 * hCaptcha checkbox for a server-action form (login, signup, magic link).
 * Renders the widget and keeps the solved token in a hidden
 * `captchaToken` input so the server action can verify it with
 * verifyHCaptchaToken() before doing anything. If the token expires the
 * widget resets and the token is cleared, so a stale submit fails
 * server-side with a clear "complete the CAPTCHA" error instead of
 * silently passing.
 */
export default function HCaptchaField() {
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey || !widgetHostRef.current) return;
    let cancelled = false;
    loadHCaptchaScript()
      .then(() => {
        if (cancelled || !widgetHostRef.current || !window.hcaptcha || widgetIdRef.current) return;
        widgetIdRef.current = window.hcaptcha.render(widgetHostRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (t: string) => {
            setToken(t);
            setError(null);
          },
          "expired-callback": () => {
            setToken("");
            widgetIdRef.current = null;
            setError("Challenge expired — please solve it again.");
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
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div>
      <input type="hidden" name="captchaToken" value={token} />
      <div className="flex justify-center">
        <div ref={widgetHostRef} />
      </div>
      {error && <p className="mt-2 text-center text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}

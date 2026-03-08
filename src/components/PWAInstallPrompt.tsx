"use client";

import { useEffect, useState } from "react";

/**
 * PWAInstallPrompt
 *
 * Shows a "Install App" banner once per hour whenever:
 *  1. The browser fires a `beforeinstallprompt` event (app is installable), AND
 *  2. The app is NOT already running in standalone / fullscreen mode (already installed), AND
 *  3. It has been at least 1 hour since the banner was last shown.
 *
 * The 1-hour cooldown is stored in localStorage under the key
 * `pwa_install_last_prompted`.  Once the user clicks "Install", the native
 * browser prompt is shown and the banner does not appear again (the
 * `beforeinstallprompt` event will no longer fire after a successful install).
 */

const STORAGE_KEY = "pwa_install_last_prompted";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/** True when the app is already running as an installed PWA. */
function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari sets this property
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Returns true if the banner should be shown based on the cooldown. */
function isCooldownElapsed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const last = parseInt(raw, 10);
    return isNaN(last) || Date.now() - last >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

/** Persist the current timestamp so the banner waits another hour. */
function recordPromptShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
}

// Extend the Window type for the non-standard `beforeinstallprompt` event.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already installed / running standalone
    if (isRunningStandalone()) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // suppress the browser's default mini-infobar
      const prompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(prompt);

      // Only show our banner if the cooldown has elapsed
      if (isCooldownElapsed()) {
        setVisible(true);
        recordPromptShown();
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    setVisible(false);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } catch {
      // prompt() or userChoice may throw if the event is no longer valid
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Install ExamArchive app"
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl p-4 shadow-xl sm:bottom-6"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* App icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/logo.png"
          alt="ExamArchive"
          width={44}
          height={44}
          className="flex-shrink-0 rounded-xl"
        />

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold leading-tight"
            style={{ color: "var(--color-text)" }}
          >
            Install ExamArchive
          </p>
          <p
            className="mt-0.5 text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Add to your home screen for quick access — works offline too.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="btn-primary flex-1 py-1.5 text-xs"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors"
              style={{
                color: "var(--color-text-muted)",
                background: "var(--color-surface)",
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="flex-shrink-0 rounded-full p-1 transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import RazorpayButton from "./RazorpayButton";

/**
 * SupportBanner
 *
 * A slim, text-only site-wide notice while the free Appwrite plan is nearly
 * exhausted. Deliberately plain — no QR image, no big buttons — so it reads
 * as a notice, not a shop. It states the 92% usage, the nightly closure
 * until Dec 5, the Razorpay support link and the WhatsApp group link.
 *
 * Dismissible; the dismissal is remembered in localStorage. Bump
 * STORAGE_KEY to show it again.
 */
const STORAGE_KEY = "ea_support_banner_dismissed_v2";

export const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/DDE3VssePR77bBTsesoyXm";

export default function SupportBanner() {
  // Start VISIBLE (not dismissed) so the server render matches what a new
  // visitor sees. Starting hidden then revealing it in useEffect pushed the
  // whole page down after hydration — a 0.24 layout shift (CLS). Returning
  // visitors who dismissed it see a brief flash before it hides; that is
  // the better trade-off, and this banner is temporary (until Dec 5).
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable (private mode) — just hide for this visit.
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Notice about ExamArchive"
      className="border-b border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm">
        <p className="min-w-0 flex-1 leading-snug">
          <span className="font-semibold">
            Notice: our free server limit is 92% used, so the site closes
            every night 10pm–6am until Dec 5.
          </span>{" "}
          Need help?{" "}
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline"
          >
            Join the WhatsApp group
          </a>
          .
        </p>
        <div className="mt-2">
          <RazorpayButton />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="shrink-0 rounded px-1.5 py-0.5 text-base font-bold leading-none text-amber-800 hover:bg-amber-200 dark:text-amber-200 dark:hover:bg-amber-900"
        >
          ×
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * SupportBanner
 *
 * A slim, text-only site-wide notice while the free Appwrite plan is nearly
 * exhausted. Deliberately plain — no QR image, no big buttons — so it reads
 * as a notice, not a shop. It states the 92% usage, the closure until the
 * next billing cycle (Dec 5), the UPI ID (tap to copy) and the WhatsApp
 * group link.
 *
 * Dismissible; the dismissal is remembered in localStorage. Bump
 * STORAGE_KEY to show it again.
 */
const STORAGE_KEY = "ea_support_banner_dismissed_v2";

export const SUPPORT_UPI_ID = "omdasg11@oksbi";
export const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/DDE3VssePR77bBTsesoyXm";

export default function SupportBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

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

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_UPI_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
            Notice: our free server limit is 92% used, so the site is closed
            until Dec 5.
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
          . To support the site, UPI:{" "}
          <button
            type="button"
            onClick={copyUpiId}
            className="font-semibold underline"
            aria-label="Copy UPI ID"
          >
            {SUPPORT_UPI_ID}
            {copied ? " (copied)" : ""}
          </button>
          .
        </p>
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

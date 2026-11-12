"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * SupportBanner
 *
 * Site-wide banner shown while the free Appwrite plan is nearly exhausted.
 * Explains the 92% usage, the nightly 10pm-6am closure, and how to help:
 * scan the UPI QR or copy the UPI ID, and join the WhatsApp group.
 *
 * Dismissible; the dismissal is remembered in localStorage so it does not
 * keep reappearing for the same visitor. Bump STORAGE_KEY to show it again.
 */
const STORAGE_KEY = "ea_support_banner_dismissed_v1";

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
      // Clipboard API unavailable — the ID is still visible to copy by hand.
      setCopied(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Support ExamArchive"
      className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Warning + support message */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            Our free server limit is 92% used.
          </p>
          <p className="mt-0.5 text-sm leading-snug">
            To keep ExamArchive running, the site closes every night from
            10pm to 6am. If you can, please support the maintenance cost —
            even a small amount helps. Scan the QR or copy the UPI ID.
          </p>
        </div>

        {/* QR + UPI ID + actions */}
        <div className="flex shrink-0 items-center gap-3">
          <Image
            src="/branding/upi-qr.png"
            alt="UPI QR code to support ExamArchive"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-md bg-white p-1 shadow-sm"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={copyUpiId}
              className="rounded-md bg-white px-2.5 py-1.5 text-left text-xs font-semibold text-amber-950 shadow-sm ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-100 dark:ring-amber-700"
              aria-label="Copy UPI ID"
            >
              {SUPPORT_UPI_ID} {copied ? "(copied)" : "(tap to copy)"}
            </button>
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[#25d366] px-2.5 py-1.5 text-center text-xs font-bold text-white shadow-sm hover:brightness-95"
            >
              Join WhatsApp Group
            </a>
          </div>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss support banner"
          className="self-start rounded-md px-2 py-1 text-lg font-bold leading-none text-amber-800 hover:bg-amber-200 dark:text-amber-200 dark:hover:bg-amber-900 sm:self-center"
        >
          ×
        </button>
      </div>
    </div>
  );
}

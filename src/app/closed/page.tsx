"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /closed — shown while the site is temporarily closed until the next
 * Appwrite billing cycle (Dec 5, 2026), when the free-plan reads reset.
 *
 * Fully static: no database reads. Kept plain and text-first — a notice,
 * not a shop. Points visitors to the WhatsApp group and lists the UPI ID
 * as text (tap to copy). No QR image here.
 */
const UPI_ID = "omdasg11@oksbi";
const WHATSAPP_GROUP_URL =
  "https://chat.whatsapp.com/DDE3VssePR77bBTsesoyXm";

export default function ClosedPage() {
  const [copied, setCopied] = useState(false);

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-3xl font-bold">ExamArchive is temporarily closed</h1>
      <p className="mt-3 text-base leading-relaxed text-on-surface-variant">
        Our free server limit is 92% used, so the site is closed until the
        next billing cycle. It will reopen on Dec 5, 2026.
      </p>

      <p className="mt-6 text-base">
        Need something? Ask in the{" "}
        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline"
        >
          WhatsApp group
        </a>
        .
      </p>

      <p className="mt-4 text-sm text-on-surface-variant">
        To support the site, UPI:{" "}
        <button
          type="button"
          onClick={copyUpiId}
          className="font-semibold text-primary underline"
          aria-label="Copy UPI ID"
        >
          {UPI_ID}
          {copied ? " (copied)" : ""}
        </button>
      </p>

      <Link href="/" className="mt-6 text-sm font-semibold text-primary underline">
        Back to home (reopens Dec 5)
      </Link>
    </main>
  );
}

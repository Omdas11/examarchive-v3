"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * /closed — shown nightly 10pm-6am IST while the site is closed to protect
 * the nearly-exhausted free Appwrite plan (92% of reads used).
 *
 * Fully static: no database reads. Points visitors to the WhatsApp group
 * for help and to the UPI QR / ID for supporting the site.
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
      <h1 className="text-3xl font-bold">ExamArchive is closed for the night</h1>
      <p className="mt-3 text-base leading-relaxed text-on-surface-variant">
        The site is open every day from 6am to 10pm (IST). It closes overnight
        to save server usage — our free server limit is 92% used.
      </p>
      <p className="mt-2 text-base font-semibold">
        We reopen at 6am.
      </p>

      <div className="mt-8 w-full rounded-xl border border-amber-300 bg-amber-50 p-5 text-left dark:border-amber-800 dark:bg-amber-950/60">
        <p className="text-sm font-bold">Support ExamArchive</p>
        <p className="mt-1 text-sm leading-snug">
          If you can, please contribute towards the maintenance cost so the
          site stays free for everyone. Scan the QR or copy the UPI ID.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Image
            src="/branding/upi-qr.png"
            alt="UPI QR code to support ExamArchive"
            width={120}
            height={120}
            className="h-[120px] w-[120px] rounded-md bg-white p-1.5 shadow-sm"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={copyUpiId}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-amber-900 dark:ring-amber-700"
              aria-label="Copy UPI ID"
            >
              {UPI_ID} {copied ? "(copied)" : "(tap to copy)"}
            </button>
            <a
              href={WHATSAPP_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[#25d366] px-3 py-2 text-center text-sm font-bold text-white shadow-sm hover:brightness-95"
            >
              Join WhatsApp Group
            </a>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-on-surface-variant">
        Need something urgently? Ask in the{" "}
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
      <Link href="/" className="mt-4 text-sm font-semibold text-primary underline">
        Back to home (reopens 6am)
      </Link>
    </main>
  );
}

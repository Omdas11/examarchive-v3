"use client";

import { useState } from "react";
import { CONTACT_EMAILS, DEFAULT_CONTACT_EMAIL } from "@/lib/contact-emails";

/** Map each footer label to an official @examarchive.dev contact address. */
const FOOTER_CONTACT_EMAILS: Record<string, string> = {
  "Help & Support": CONTACT_EMAILS.help,
  "Contact Us": CONTACT_EMAILS.contact,
  "Send Feedback": CONTACT_EMAILS.feedback,
};

/**
 * A client component that renders a text link and, on click, shows a small
 * modal with the official @examarchive.dev contact address for that topic.
 */
export default function FooterContactModal({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const email = FOOTER_CONTACT_EMAILS[label] ?? DEFAULT_CONTACT_EMAIL;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left hover:underline hover:opacity-80 transition-opacity text-xs cursor-pointer bg-transparent border-0 p-0"
        style={{ color: "inherit" }}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="card p-6 max-w-xs w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <span
              className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>

            <h2 className="text-base font-semibold mb-1">{label}</h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Reach us at{" "}
              <a
                href={`mailto:${email}`}
                className="font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                {email}
              </a>
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary mt-5 w-full text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

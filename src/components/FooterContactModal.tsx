"use client";

import { useState } from "react";

/**
 * A client component that renders a text link and, on click, shows a small
 * modal informing users that the feature is under development.
 */
export default function FooterContactModal({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left hover:underline hover:opacity-80 transition-opacity text-xs"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}
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
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>

            <h2 className="text-base font-semibold mb-1">{label}</h2>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Under development &mdash; coming soon.
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-primary mt-5 w-full text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface TypeToConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmWord: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const TITLE_ID = "type-to-confirm-title";

export default function TypeToConfirmModal({
  open,
  title,
  description,
  confirmWord,
  onConfirm,
  onCancel,
  loading,
}: TypeToConfirmModalProps) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset input and move focus into the dialog when it opens.
  useEffect(() => {
    if (open) {
      setTyped("");
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Close on Escape key.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Trap focus inside the dialog.
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", trapFocus);
      return () => document.removeEventListener("keydown", trapFocus);
    }
  }, [open, trapFocus]);

  if (!open) return null;

  // Exact match — no trim or case normalisation so the confirmation is meaningful.
  const isMatch = typed === confirmWord;

  return (
    <div className="confirm-modal-backdrop" onClick={onCancel} aria-hidden="true">
      <div
        ref={dialogRef}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id={TITLE_ID}
          className="text-base font-bold flex items-center gap-2"
          style={{ color: "var(--brand-crimson)" }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </h3>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {description}
        </p>
        <p className="mt-3 text-sm font-medium">
          Type <code className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "var(--color-accent-soft)", color: "var(--brand-crimson)" }}>{confirmWord}</code> exactly to confirm:
        </p>
        <input
          ref={inputRef}
          id="type-to-confirm-input"
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="input-field mt-2"
          placeholder={`Type ${confirmWord} here…`}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Type ${confirmWord} to confirm`}
        />
        <div className="mt-4 flex gap-2 justify-end">
          <button
            type="button"
            className="btn text-sm px-4 py-2"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn text-sm px-4 py-2 disabled:opacity-40"
            style={
              isMatch
                ? { background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }
                : { opacity: 0.4 }
            }
            disabled={!isMatch || loading}
            onClick={onConfirm}
          >
            {loading && <span className="btn-spinner" />}
            {loading ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

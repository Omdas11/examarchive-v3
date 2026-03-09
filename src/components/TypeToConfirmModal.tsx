"use client";

import { useState, useEffect, useRef } from "react";

interface TypeToConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmWord: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

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

  useEffect(() => {
    if (open) {
      setTyped("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const isMatch = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3
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
          Type <code className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: "var(--color-accent-soft)", color: "var(--brand-crimson)" }}>{confirmWord}</code> to confirm:
        </p>
        <input
          ref={inputRef}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="input-field mt-2"
          placeholder={`Type ${confirmWord} here…`}
          autoComplete="off"
          spellCheck={false}
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

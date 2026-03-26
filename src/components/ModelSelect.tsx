"use client";

import { useState, useRef, useEffect, useId } from "react";
import { getModelCapability } from "@/lib/model-capabilities";

interface ModelSelectOption {
  id: string;
  label: string;
  available: boolean;
}

interface ModelSelectProps {
  options: ModelSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Enhanced model selector with capability indicators
 */
export default function ModelSelect({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();

  const selectedOption = options.find((o) => o.id === value);
  const selectedCapability = selectedOption ? getModelCapability(selectedOption.id) : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function select(optionId: string) {
    const option = options.find((o) => o.id === optionId);
    if (option && option.available) {
      onChange(optionId);
      setOpen(false);
    }
  }

  const listboxId = `model-select-list-${instanceId.replace(/:/g, "")}`;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="input-field w-full text-left flex items-center justify-between gap-2 cursor-pointer"
        style={{
          borderColor: open ? "var(--color-primary)" : undefined,
          outline: open ? `1px solid var(--color-primary)` : undefined,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", gap: 8 }}>
          {selectedCapability ? (
            <>
              <SimpleDot active />
              <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedCapability.displayName}
              </span>
              {selectedCapability.badge && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 6px",
                    borderRadius: "9999px",
                    background: "var(--brand-crimson)",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  {selectedCapability.badge}
                </span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>Select model…</span>
          )}
        </div>
        <Chevron open={open} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 9999,
            marginTop: 4,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-primary)",
            background: "var(--color-surface)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            maxHeight: 320,
            overflowY: "auto",
            padding: "4px 0",
          }}
        >
          {options.map((opt) => {
            const capability = getModelCapability(opt.id);
            const active = opt.id === value;
            const locked = !opt.available;

            return (
              <div
                key={opt.id}
                role="option"
                aria-selected={active}
                aria-disabled={locked}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!locked) select(opt.id);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: locked ? "not-allowed" : "pointer",
                  background: active ? "var(--color-accent-soft)" : "transparent",
                  opacity: locked ? 0.6 : 1,
                  borderBottom: "1px solid var(--color-border)",
                  transition: "background 0.1s",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
                onMouseEnter={(e) => {
                  if (!active && !locked) (e.currentTarget as HTMLElement).style.background = "var(--color-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <SimpleDot active={active} muted={locked} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {capability.displayName}
                    </span>
                    {capability.badge && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 6px",
                          borderRadius: "9999px",
                          background: "var(--brand-crimson)",
                          color: "white",
                          fontWeight: 600,
                        }}
                      >
                        {capability.badge}
                      </span>
                    )}
                    {locked && <LockIcon />}
                  </div>
                  {capability.description && (
                    <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {capability.description}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SimpleDot({ active, muted }: { active?: boolean; muted?: boolean }) {
  const color = muted ? "#9ca3af" : active ? "var(--color-primary)" : "#4b5563";
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6" fill={color} />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        transition: "transform 0.15s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        color: "var(--color-text-muted)",
      }}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" aria-hidden="true">
      <rect x="6" y="10" width="12" height="9" rx="2" />
      <path d="M9 10V8a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

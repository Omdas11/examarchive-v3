"use client";

import { useState, useRef, useEffect, useId } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  name: string;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * Accessible custom dropdown that:
 * - Stays open during page scroll (uses absolute positioning relative to the wrapper)
 * - Doesn't close on touch-scroll (only closes on explicit select or outside click)
 * - Prevents overlap issues with adjacent dropdowns via z-index management
 * - Styled with the red accent theme
 */
export default function CustomSelect({
  name,
  options,
  placeholder = "Select…",
  required,
  value: controlledValue,
  onChange,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const instanceId = useId();

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click (but NOT during touch-scroll)
  useEffect(() => {
    if (!open) return;
    let touchMoved = false;

    function onTouchStart() { touchMoved = false; }
    function onTouchMove() { touchMoved = true; }

    function onMouseDown(e: MouseEvent) {
      if (touchMoved) return;
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [open]);

  function select(optionValue: string) {
    if (controlledValue === undefined) setInternalValue(optionValue);
    onChange?.(optionValue);
    setOpen(false);
  }

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = options[(idx + 1) % options.length];
      if (next) select(next.value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = options[(idx - 1 + options.length) % options.length];
      if (prev) select(prev.value);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  const listboxId = `custom-select-list-${instanceId.replace(/:/g, "")}`;

  return (
    <span className={`relative block ${className}`}>
      {/* Hidden native input for form submission */}
      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
        aria-hidden="true"
      />

      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-required={required}
        onKeyDown={onKeyDown}
        onClick={() => setOpen((o) => !o)}
        className="input-field w-full text-left flex items-center justify-between gap-2 cursor-pointer"
        style={{
          borderColor: open ? "var(--color-primary)" : undefined,
          outline: open ? `1px solid var(--color-primary)` : undefined,
        }}
      >
        <span
          style={{
            color: selectedOption
              ? "var(--color-text)"
              : "var(--color-text-muted)",
            opacity: selectedOption ? 1 : 0.6,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
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
      </button>

      {/* Dropdown panel – absolutely positioned below trigger, scrolls with page */}
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100%",
            zIndex: 9999,
            marginTop: 4,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-primary)",
            background: "var(--color-surface)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            maxHeight: 220,
            overflowY: "auto",
            listStyle: "none",
            padding: "4px 0",
            margin: "4px 0 0",
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent button blur
                  select(opt.value);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  select(opt.value);
                }}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  background: active ? "var(--color-accent-soft)" : "transparent",
                  color: active ? "var(--color-primary)" : "var(--color-text)",
                  fontWeight: active ? 600 : 400,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "var(--color-accent-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}


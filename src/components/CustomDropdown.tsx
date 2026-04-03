"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type CustomDropdownOption = {
  label: string;
  value: string;
};

type CustomDropdownProps = {
  options: CustomDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  className = "",
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const instanceId = useId();
  const selected = options.find((option) => option.value === value);
  const listboxId = `custom-dropdown-${instanceId.replace(/:/g, "")}`;

  useEffect(() => {
    if (!open) return;
    function onMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function select(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open && (event.key === "Enter" || event.key === " " || event.key === "ArrowDown")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open || options.length === 0) return;

    const index = options.findIndex((option) => option.value === value);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      select(options[(index + 1) % options.length].value);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      select(options[(index - 1 + options.length) % options.length].value);
    } else if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

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
        onKeyDown={onKeyDown}
        onClick={() => !disabled && setOpen((current) => !current)}
        className="input-field flex w-full items-center justify-between gap-2 text-left"
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          borderColor: open ? "var(--color-primary)" : undefined,
          outline: open ? "1px solid var(--color-primary)" : undefined,
        }}
      >
        <span
          style={{
            color: selected ? "var(--color-text)" : "var(--color-text-muted)",
            opacity: selected ? 1 : 0.7,
          }}
        >
          {selected ? selected.label : placeholder}
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
            color: "var(--color-text-muted)",
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={panelRef}
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-full mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-outline-variant/40 bg-surface shadow-lift"
          style={{ zIndex: 9999 }}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  select(option.value);
                }}
                className="cursor-pointer px-3 py-2 text-sm"
                style={{
                  background: active ? "var(--color-accent-soft)" : "transparent",
                  color: active ? "var(--color-primary)" : "var(--color-text)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Default launch progress percentage shown when no value is stored in site_metrics. */
const DEFAULT_LAUNCH_PROGRESS = 40;
const STORAGE_KEY = "ea:dev-progress-hidden:v1";
const PULL_SWIPE_THRESHOLD = 25;

interface DevProgressBarProps {
  /** Completion percentage (0–100). */
  progress?: number;
}

/**
 * A thin banner shown on the homepage indicating early-access / development status.
 * The bar fills from left to right based on `progress`.
 */
export default function DevProgressBar({ progress = DEFAULT_LAUNCH_PROGRESS }: DevProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const [isOpen, setIsOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hidden = window.localStorage.getItem(STORAGE_KEY) === "1";
    setIsOpen(!hidden);
  }, []);

  const setOpenState = (open: boolean) => {
    setIsOpen(open);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, open ? "0" : "1");
  };

  return (
    <div className="fixed inset-x-0 z-30 pointer-events-none px-4" style={{ top: "var(--layout-header-height)" }}>
      <div className="mx-auto w-full max-w-[var(--max-w)] pointer-events-auto">
        <button
          type="button"
          className={cn(
            "mx-auto flex items-center gap-1 rounded-b-lg border border-outline-variant/30 px-3 py-1 text-[11px] font-semibold shadow-sm transition-colors",
            "bg-surface text-on-surface-variant hover:bg-surface-container-low"
          )}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Hide development notice" : "Show development notice"}
          onClick={() => setOpenState(!isOpen)}
          onTouchStart={(e) => setTouchStartY(e.touches[0]?.clientY ?? null)}
          onTouchEnd={(e) => {
            if (touchStartY === null) return;
            const endY = e.changedTouches[0]?.clientY ?? touchStartY;
            const deltaY = endY - touchStartY;
            if (!isOpen && deltaY > PULL_SWIPE_THRESHOLD) setOpenState(true);
            if (isOpen && deltaY < -PULL_SWIPE_THRESHOLD) setOpenState(false);
            setTouchStartY(null);
          }}
        >
          <span className="material-symbols-outlined text-sm">
            {isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
          {isOpen ? "Hide early development notice" : "Pull down for development notice"}
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            isOpen ? "max-h-[220px] opacity-100 mt-2" : "max-h-0 opacity-0"
          )}
        >
          <div
            className="rounded-lg p-4 text-center"
            style={{
              background: "color-mix(in srgb, var(--pending-amber) 12%, var(--color-surface))",
              border: "1px solid color-mix(in srgb, var(--pending-amber) 30%, transparent)",
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold flex items-center justify-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pending-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Early Development — Platform launch progress
              </p>
              <button
                type="button"
                className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-low"
                onClick={() => setOpenState(false)}
                aria-label="Dismiss development notice"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div
              className="relative w-full rounded-full overflow-hidden mx-auto"
              style={{
                height: 10,
                maxWidth: 420,
                background: "color-mix(in srgb, var(--pending-amber) 20%, var(--color-border))",
              }}
              role="progressbar"
              aria-valuenow={clamped}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Platform launch progress: ${clamped}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${clamped}%`,
                  background:
                    "linear-gradient(90deg, var(--pending-amber) 0%, var(--brand-crimson) 100%)",
                }}
              />
            </div>

            <p className="text-xs mt-1.5" style={{ color: "var(--color-text-muted)" }}>
              {clamped}% towards soft launch · Starting with{" "}
              <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Haflong Government College</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

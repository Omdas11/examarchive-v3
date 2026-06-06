"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Default launch progress percentage shown when no value is stored in site_metrics. */
const DEFAULT_LAUNCH_PROGRESS = 40;
const STORAGE_KEY = "ea_dev_progress_hidden_v1";
const LEGACY_STORAGE_KEY = "ea:dev-progress-hidden:v1";
const PULL_SWIPE_THRESHOLD = 25;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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

  const getHiddenPref = useCallback(() => {
    if (typeof document === "undefined") return false;
    const rawValue = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${STORAGE_KEY}=`))
      ?.slice(STORAGE_KEY.length + 1);
    const value = rawValue ? decodeURIComponent(rawValue) : undefined;
    return value === "1";
  }, []);

  const persistHiddenPref = useCallback((hidden: boolean) => {
    if (typeof document === "undefined") return;
    const isProduction = process.env.NODE_ENV === "production";
    const secureAttr =
      isProduction || (typeof window !== "undefined" && window.location.protocol === "https:")
        ? "; Secure"
        : "";
    const value = encodeURIComponent(hidden ? "1" : "0");
    document.cookie = `${STORAGE_KEY}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureAttr}`;
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const legacyHidden = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyHidden === "1" || legacyHidden === "0") {
        persistHiddenPref(legacyHidden === "1");
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    const hidden = getHiddenPref();
    setIsOpen(!hidden);
  }, [getHiddenPref, persistHiddenPref]);

  const setOpenState = (open: boolean) => {
    setIsOpen(open);
    persistHiddenPref(!open);
  };

  return (
    <div className="fixed inset-x-0 z-30 pointer-events-none px-4" style={{ top: "var(--layout-header-height)" }}>
      <div className="mx-auto w-full max-w-[var(--max-w)] pointer-events-auto">
        <button
          type="button"
          className={cn(
            "mx-auto flex items-center gap-2 rounded-b-2xl border border-outline-variant/20 px-5 py-2 text-xs font-bold shadow-lift transition-all active:scale-95",
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
          <span className="material-symbols-outlined text-base font-bold">
            {isOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}
          </span>
          {isOpen ? "Hide early development notice" : "Development Progress"}
        </button>

        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-out",
            isOpen ? "max-h-[220px] opacity-100 mt-3" : "max-h-0 opacity-0"
          )}
        >
          <div
            className="rounded-3xl border border-primary/10 bg-surface shadow-floating p-6 text-center"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-bold flex items-center justify-center gap-2 text-on-surface">
                <span className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-base font-bold text-primary">analytics</span>
                </span>
                Early Development — Launch Progress
              </p>
              <button
                type="button"
                className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                onClick={() => setOpenState(false)}
                aria-label="Dismiss development notice"
              >
                <span className="material-symbols-outlined text-sm font-bold">close</span>
              </button>
            </div>

            <div
              className="relative w-full rounded-full overflow-hidden mx-auto border border-outline-variant/10 shadow-inner"
              style={{
                height: 12,
                maxWidth: 480,
                background: "var(--color-bg)",
              }}
              role="progressbar"
              aria-valuenow={clamped}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Platform launch progress: ${clamped}%`}
            >
              <div
                className="h-full rounded-full gradient-primary transition-all duration-1000 ease-out"
                style={{
                  width: `${clamped}%`,
                }}
              />
            </div>

            <p className="text-xs mt-3 text-on-surface-variant font-medium">
              <span className="text-primary font-bold">{clamped}%</span> towards soft launch · Starting with{" "}
              <span className="text-primary font-bold">Haflong Government College</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

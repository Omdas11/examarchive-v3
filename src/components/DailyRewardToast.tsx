"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

interface DailyRewardToastProps {
  /** The reward awarded on this page load, or null when nothing was earned. */
  reward: { xp: number; streak: number } | null;
  onClose: () => void;
}

/**
 * Animated daily-login reward toast.
 *
 * Shows once when the server awards the daily login XP (first authenticated
 * visit of the UTC day) — a flame, the +XP amount and the current streak.
 * Slides in with the site's toast animation, dismisses itself after 6s, and
 * can be closed early. The positioning translate lives on the outer wrapper
 * so the inner animation's transform never overrides it.
 */
export default function DailyRewardToast({ reward, onClose }: DailyRewardToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [reward, onClose]);

  if (!reward || !visible) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[95] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-toast-in card flex items-center gap-3 px-4 py-3 shadow-floating"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-accent-soft)" }}
        >
          <Icon name="fire" size={20} style={{ color: "var(--color-primary)" }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold whitespace-nowrap">Daily reward: +{reward.xp} XP</p>
          <p className="text-xs whitespace-nowrap" style={{ color: "var(--color-text-muted)" }}>
            Day {reward.streak} streak — come back tomorrow to keep it going.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          aria-label="Dismiss daily reward"
          className="ml-1 shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
            close
          </span>
        </button>
      </div>
    </div>
  );
}

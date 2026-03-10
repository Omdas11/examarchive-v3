"use client";

import { useEffect, useRef } from "react";

interface XPBarProps {
  /** Target fill percentage (0–100). */
  percent: number;
  /** XP label shown on the left (e.g. "150 XP · Explorer"). */
  leftLabel: string;
  /** Optional right label (e.g. "Next: Contributor (300 XP)"). */
  rightLabel?: string;
}

/**
 * Animated XP progress bar.
 * Starts at 0% width and smoothly fills to `percent` on mount.
 * Uses a plain <div> instead of milestone pips so the bar never overflows.
 */
export default function XPBar({ percent, leftLabel, rightLabel }: XPBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const targetWidth = `${Math.max(0, Math.min(100, percent))}%`;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reset instantly before starting a new animation.
    el.style.transition = "none";
    el.style.width = "0%";

    if (reduceMotion) {
      el.style.width = targetWidth;
      return;
    }

    // Force a reflow so the 0% reset is painted before the transition starts.
    void el.offsetWidth;
    const raf = requestAnimationFrame(() => {
      el.style.transition = "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.width = targetWidth;
    });
    return () => cancelAnimationFrame(raf);
  }, [percent]);

  return (
    <div className="w-full mt-5">
      <div
        className="relative"
        style={{
          height: 8,
          background: "var(--color-border)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          ref={fillRef}
          style={{
            height: "100%",
            borderRadius: 4,
            background: "var(--brand-crimson)",
            width: "0%",
          }}
        />
      </div>
      <div
        className="flex justify-between mt-2 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span>{leftLabel}</span>
        {rightLabel && <span>{rightLabel}</span>}
      </div>
    </div>
  );
}

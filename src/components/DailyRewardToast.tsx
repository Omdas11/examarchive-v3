"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icons";

interface DailyRewardToastProps {
  /** The reward awarded on this page load, or null when nothing was earned. */
  reward: { xp: number; streak: number } | null;
  onClose: () => void;
}

/** Short celebratory chime, synthesized with Web Audio (no audio file). */
function playRewardChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Browsers keep the context suspended until the user has interacted
    // with the page; notes scheduled while suspended play when (and if) it
    // resumes, and nothing breaks if they never do.
    void ctx.resume?.();
    const note = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    };
    // Bright major arpeggio: E5 -> G#5 -> B5.
    note(659.25, 0, 0.18);
    note(830.61, 0.09, 0.18);
    note(987.77, 0.18, 0.34);
    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 900);
  } catch {
    // Sound is best-effort: never break the toast for it.
  }
}

/**
 * Daily-login reward toast, deliberately UNMISSABLE: an emerald-to-blue
 * animated gradient matching the site hero, a chime, and an 8s display.
 * Shows once when the server awards the daily login XP (first authenticated
 * visit of the UTC day). The positioning translate lives on the outer wrapper
 * so the inner animation's transform never overrides it.
 */
export default function DailyRewardToast({ reward, onClose }: DailyRewardToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!reward) return;
    setVisible(true);
    playRewardChime();
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 8000);
    return () => clearTimeout(timer);
  }, [reward, onClose]);

  if (!reward || !visible) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[95] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div
        className="animate-toast-in reward-gradient flex items-center gap-3 rounded-2xl px-4 py-3 shadow-floating"
        style={{ border: "1px solid rgba(255,255,255,0.4)" }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.25)" }}
        >
          <Icon name="fire" size={20} style={{ color: "#ffffff" }} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold whitespace-nowrap" style={{ color: "#ffffff" }}>
            Daily reward: +{reward.xp} XP
          </p>
          <p className="text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.85)" }}>
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
          className="ml-1 shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/20"
          style={{ color: "#ffffff" }}
        >
          <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
            close
          </span>
        </button>
      </div>
    </div>
  );
}

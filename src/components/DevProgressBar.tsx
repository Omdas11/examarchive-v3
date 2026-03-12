"use client";

/** Default launch progress percentage shown when no value is stored in site_metrics. */
const DEFAULT_LAUNCH_PROGRESS = 40;

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

  return (
    <div
      className="rounded-lg p-4 mb-6 text-center"
      style={{
        background: "color-mix(in srgb, var(--pending-amber) 12%, var(--color-surface))",
        border: "1px solid color-mix(in srgb, var(--pending-amber) 30%, transparent)",
      }}
    >
      <p className="text-xs font-semibold mb-2 flex items-center justify-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
        {/* Construction / warning SVG */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pending-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Early Development — Platform launch progress
      </p>

      {/* Progress track */}
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
        <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Assam University</span>
      </p>
    </div>
  );
}

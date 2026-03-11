"use client";

interface DevProgressBarProps {
  /** Completion percentage (0–100). */
  progress?: number;
}

/**
 * A thin banner shown on the homepage indicating early-access / development status.
 * The bar fills from left to right based on `progress`.
 */
export default function DevProgressBar({ progress = 40 }: DevProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="rounded-lg p-4 mb-6 text-center"
      style={{
        background: "color-mix(in srgb, var(--pending-amber) 12%, var(--color-surface))",
        border: "1px solid color-mix(in srgb, var(--pending-amber) 30%, transparent)",
      }}
    >
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        🚧 Early Development — Platform launch progress
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

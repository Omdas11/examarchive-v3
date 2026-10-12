"use client";

/**
 * ExamArchive loading screen — new brand.
 * Shows the EA monogram with a breathing pulse + progress shimmer.
 * Falls back to an inline emerald badge if the logo image fails.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center gap-5 px-4">
      <div
        className="relative flex h-28 w-28 items-center justify-center"
        aria-hidden="true"
      >
        {/* Soft glow ring */}
        <div
          className="absolute inset-0 rounded-[2rem]"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)",
            animation: "ea-logo-pulse 1.6s ease-in-out infinite",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/logo.png"
          width={112}
          height={112}
          alt=""
          className="relative rounded-[1.75rem] shadow-lg"
          style={{ animation: "ea-logo-pulse 1.6s ease-in-out infinite" }}
        />
      </div>

      <p
        className="text-sm font-bold tracking-[0.25em] uppercase"
        style={{ color: "var(--color-primary)" }}
      >
        ExamArchive
      </p>

      {/* Shimmer progress bar */}
      <div
        className="h-1.5 w-44 overflow-hidden rounded-full"
        style={{ background: "var(--color-border, #e5e7eb)" }}
      >
        <div
          className="h-full w-1/2 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--color-primary), var(--color-primary-hover))",
            animation: "ea-loading-slide 1.2s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes ea-loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

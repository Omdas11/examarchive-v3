"use client";

import { useState } from "react";

type LoadSrc = "png" | "svg" | "none";

export default function Loading() {
  // Track which icon source to try: png → svg → none (inline fallback)
  const [src, setSrc] = useState<LoadSrc>("png");

  const imgSrc =
    src === "png"
      ? "/branding/loading.png"
      : src === "svg"
        ? "/logos/loading/ea-loader.svg"
        : null;

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center gap-3">
      {/*
        Loading icon priority:
          1. /public/branding/loading.png  (custom PNG – recommended)
          2. /public/logos/loading/ea-loader.svg  (legacy SVG path)
          3. Inline animated EA badge fallback (always works)
      */}
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={imgSrc}
          width={40}
          height={40}
          alt=""
          aria-hidden="true"
          style={{ animation: "ea-logo-pulse 1.4s ease-in-out infinite" }}
          onError={() => setSrc(src === "png" ? "svg" : "none")}
        />
      ) : (
        /* Inline fallback – shown only when all image paths fail */
        <div
          className="h-10 w-10 flex items-center justify-center rounded-xl"
          style={{ background: "var(--color-primary)", animation: "ea-logo-pulse 1.4s ease-in-out infinite" }}
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* E */}
            <path d="M2 3h5v1.8H3.8v2h3v1.8h-3v2.2H7V12.6H2V3Z" fill="white" />
            {/* A */}
            <path d="M9.5 3h2.1l3 9.6H12.4l-.55-1.9h-2.9l-.56 1.9H6.7L9.5 3Zm1.05 2.2-1.02 3.8h2.04l-1.02-3.8Z" fill="white" />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes ea-logo-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(0.92); }
        }
      `}</style>
    </div>
  );
}


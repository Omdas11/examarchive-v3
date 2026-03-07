/**
 * EALogo – reusable ExamArchive logo component.
 *
 * Custom branding:
 *   Place a PNG file at /public/branding/logo.png (or logo.svg) and it will
 *   automatically be used instead of the default inline SVG monogram.
 *   The file is loaded via a standard <img> tag; if it fails to load (e.g.
 *   the file doesn't exist yet) the inline SVG "EA" badge is shown as a
 *   fallback so the site always renders correctly.
 *
 * To revert to the built-in monogram, simply remove /public/branding/logo.png.
 */
"use client";

import { useState } from "react";

interface EALogoProps {
  /** Width/height of the logo badge in px (default 28). */
  size?: number;
  /** Extra class names for the outer element. */
  className?: string;
}

export default function EALogo({ size = 28, className = "" }: EALogoProps) {
  // Try the PNG first, then SVG; fall back to the inline monogram on error.
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/branding/logo.png"
        width={size}
        height={size}
        alt="ExamArchive"
        className={`rounded-md select-none ${className}`}
        style={{ width: size, height: size, objectFit: "contain" }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Inline SVG fallback (always works, no network request)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-black text-white select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: "var(--color-primary)",
        fontSize: size * 0.38,
        letterSpacing: "-0.03em",
      }}
      aria-hidden="true"
    >
      {/* SVG "EA" monogram – displayed when no /public/branding/logo.png exists */}
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="EA"
      >
        {/* E */}
        <path
          d="M2 3h5v1.8H3.8v2h3v1.8h-3v2.2H7V12.6H2V3Z"
          fill="white"
        />
        {/* A */}
        <path
          d="M9.5 3h2.1l3 9.6H12.4l-.55-1.9h-2.9l-.56 1.9H6.7L9.5 3Zm1.05 2.2-1.02 3.8h2.04l-1.02-3.8Z"
          fill="white"
        />
      </svg>
    </span>
  );
}

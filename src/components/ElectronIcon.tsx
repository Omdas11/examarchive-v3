/**
 * ElectronIcon — premium SVG icon for the Electron currency.
 *
 * Design: a glowing coin with an electron-orbit ring and the "e" glyph.
 * Colours are inherited via `currentColor` so the icon adapts to any
 * parent text colour.
 */

import React from "react";

interface ElectronIconProps {
  /** Width / height in pixels (square). Default: 16 */
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export default function ElectronIcon({
  size = 16,
  className,
  "aria-hidden": ariaHidden = true,
}: ElectronIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      {/* Outer glow ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="2 3"
      />

      {/* Coin body */}
      <circle
        cx="12"
        cy="12"
        r="7.5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      {/* Diagonal orbit line */}
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="3.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.4"
        transform="rotate(-35 12 12)"
      />

      {/* Electron dot on orbit */}
      <circle cx="17.5" cy="9.2" r="1.4" fill="currentColor" fillOpacity="0.85" />

      {/* "e" glyph */}
      <text
        x="12"
        y="15.8"
        textAnchor="middle"
        fontSize="9"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fill="currentColor"
      >
        e
      </text>
    </svg>
  );
}

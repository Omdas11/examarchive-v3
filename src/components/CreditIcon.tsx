/**
 * CreditIcon — premium SVG icon for the Credit currency.
 *
 * Design: a glowing coin with the "₹" glyph.
 * Colours are inherited via `currentColor` so the icon adapts to any
 * parent text colour.
 */

import React from "react";

interface CreditIconProps {
  /** Width / height in pixels (square). Default: 16 */
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export default function CreditIcon({
  size = 16,
  className,
  "aria-hidden": ariaHidden = true,
}: CreditIconProps) {
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

      {/* "₹" glyph */}
      <text
        x="12"
        y="15.8"
        textAnchor="middle"
        fontSize="10"
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="800"
        fill="currentColor"
      >
        ₹
      </text>
    </svg>
  );
}

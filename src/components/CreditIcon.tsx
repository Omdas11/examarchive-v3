/**
 * CreditIcon — ExamArchive virtual token icon.
 *
 * Design: a gold coin (full gold shades) with a lowercase "e" monogram.
 * This is the brand symbol for virtual tokens, replacing the ₹ glyph.
 * (₹ is reserved for real INR amounts, e.g. Razorpay pack prices.)
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
  const gid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
      role="img"
      aria-label="token"
    >
      <defs>
        <radialGradient id={`coin-${gid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFE9A8" />
          <stop offset="45%" stopColor="#F5C542" />
          <stop offset="100%" stopColor="#C98A12" />
        </radialGradient>
        <linearGradient id={`rim-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B97A0E" />
          <stop offset="50%" stopColor="#F7D774" />
          <stop offset="100%" stopColor="#A86A0A" />
        </linearGradient>
      </defs>
      {/* Coin body — gold */}
      <circle cx="12" cy="12" r="11" fill={`url(#coin-${gid})`} />
      {/* Rim */}
      <circle
        cx="12"
        cy="12"
        r="10.2"
        fill="none"
        stroke={`url(#rim-${gid})`}
        strokeWidth="1.6"
      />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r="7.6"
        fill="none"
        stroke="#9A6208"
        strokeWidth="1"
        strokeOpacity="0.55"
      />
      {/* "e" monogram */}
      <text
        x="12"
        y="16.8"
        textAnchor="middle"
        fontSize="12"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="800"
        fill="#7A4E06"
      >
        e
      </text>
    </svg>
  );
}

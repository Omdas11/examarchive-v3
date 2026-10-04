/**
 * CreditIcon — ExamArchive virtual token icon.
 *
 * Design: a maroon coin with the "EA" monogram and gold ring.
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
      {/* Coin body */}
      <circle cx="12" cy="12" r="11" fill="#800000" />
      {/* Gold inner ring */}
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="#E8B84B"
        strokeWidth="1.2"
      />
      {/* "EA" monogram */}
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize="9.5"
        fontFamily="Inter, Arial, sans-serif"
        fontWeight="700"
        fill="#FFFFFF"
      >
        EA
      </text>
    </svg>
  );
}

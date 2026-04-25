/**
 * SupporterBadge — premium SVG badge awarded to Supporter-tier subscribers.
 *
 * Design: a shield with a star and "S" monogram in amber/gold tones.
 */

import React from "react";

interface BadgeProps {
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export function SupporterBadge({ size = 24, className, "aria-label": ariaLabel = "Supporter badge" }: BadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      {/* Shield background */}
      <path
        d="M16 2L4 7v9c0 6.627 5.186 11.927 12 13 6.814-1.073 12-6.373 12-13V7L16 2Z"
        fill="#f59e0b"
        fillOpacity="0.15"
        stroke="#f59e0b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner shield highlight */}
      <path
        d="M16 5.5L6.5 9.5v6.5c0 5 3.9 9.3 9.5 10.4 5.6-1.1 9.5-5.4 9.5-10.4V9.5L16 5.5Z"
        fill="#fde68a"
        fillOpacity="0.25"
      />

      {/* Star */}
      <path
        d="M16 9l1.545 4.753H22.18l-4.045 2.94 1.546 4.753L16 18.506l-3.68 2.94 1.545-4.753-4.045-2.94h4.635L16 9Z"
        fill="#f59e0b"
        fillOpacity="0.9"
      />
    </svg>
  );
}

export function FirstPdfBadge({ size = 24, className, "aria-label": ariaLabel = "First PDF generated badge" }: BadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={ariaLabel}
      role="img"
    >
      {/* Hexagon background */}
      <path
        d="M16 2l12.124 7v14L16 30 3.876 23V9L16 2Z"
        fill="#6366f1"
        fillOpacity="0.12"
        stroke="#6366f1"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Document icon */}
      <rect x="10" y="8" width="9" height="12" rx="1.5" fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="1.2" />
      <path d="M12.5 12h5M12.5 14.5h5M12.5 17h3" stroke="#6366f1" strokeWidth="1" strokeLinecap="round" />

      {/* Spark / star burst */}
      <path
        d="M19 8l.5-1.5.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5z"
        fill="#f59e0b"
      />
    </svg>
  );
}

/**
 * EALogo – reusable ExamArchive SVG logo component.
 * Swap the SVG content here to update the logo site-wide.
 */

interface EALogoProps {
  /** Width/height of the logo badge in px (default 28). */
  size?: number;
  /** Extra class names for the outer element. */
  className?: string;
}

export default function EALogo({ size = 28, className = "" }: EALogoProps) {
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
      {/* SVG "EA" monogram – replace this SVG to update the logo globally */}
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

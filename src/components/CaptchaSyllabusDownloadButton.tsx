"use client";

interface CaptchaSyllabusDownloadButtonProps {
  paperCode?: string;
  subjectCode?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Download button for a generated syllabus PDF (single-paper or
 * departmental).
 *
 * NOTE: this used to gate every download behind an hCaptcha checkbox.
 * The hCaptcha secret in Vercel never matched the site key, so the check
 * rejected every solved checkbox and downloads were broken for everyone.
 * The gate was removed (2026-11-14) and this is now a plain direct link
 * to the syllabus PDF endpoint. The component keeps its old name and
 * props so every call site works unchanged.
 */
export default function CaptchaSyllabusDownloadButton({
  paperCode,
  subjectCode,
  className,
  children,
}: CaptchaSyllabusDownloadButtonProps) {
  if (!paperCode && !subjectCode) {
    // Misconfigured: fall back to prompting sign-in rather than a dead button.
    return (
      <a href="/login" className={className}>
        {children}
      </a>
    );
  }

  const params = new URLSearchParams({ mode: "pdf" });
  if (paperCode) params.set("paperCode", paperCode);
  if (subjectCode) params.set("subjectCode", subjectCode);

  return (
    <a
      href={`/api/syllabus/table?${params.toString()}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

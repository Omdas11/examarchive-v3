"use client";

interface CaptchaDownloadButtonProps {
  fileId: string | undefined;
  fileUrl: string;
  className?: string;
  /** Accessible title / tooltip for the button (e.g. "Download PDF"). */
  title?: string;
  children: React.ReactNode;
}

/**
 * Download button for a paper PDF.
 *
 * NOTE: this used to gate every download behind an hCaptcha checkbox.
 * The hCaptcha secret in Vercel never matched the site key, so the check
 * rejected every solved checkbox and downloads were broken for everyone.
 * The gate was removed (2026-11-14) and this is now a plain direct link:
 * logged-in users open the PDF, signed-out visitors are sent to /login
 * by the file route. The component keeps its old name and props so every
 * call site works unchanged.
 */
export default function CaptchaDownloadButton({
  fileId,
  fileUrl,
  className,
  title,
  children,
}: CaptchaDownloadButtonProps) {
  if (!fileId && !fileUrl) {
    // No file at all: a dead button helps nobody — say so plainly.
    return (
      <span className={className} aria-disabled="true" style={{ opacity: 0.55 }}>
        PDF not yet uploaded
      </span>
    );
  }

  if (!fileId) {
    // External / non-bucket file (plain file_url, no Appwrite file id):
    // it is not served by our server, so link directly.
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={className} title={title}>
        {children}
      </a>
    );
  }

  return (
    <a
      href={`/api/files/papers/${encodeURIComponent(fileId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title}
    >
      {children}
    </a>
  );
}

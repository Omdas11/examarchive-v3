import nodemailer from "nodemailer";

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.examarchive.dev"
  ).replace(/\/+$/, "");
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!Number.isFinite(port) || port <= 0) missing.push("SMTP_PORT");
  if (missing.length > 0) {
    throw new Error(`SMTP configuration incomplete: missing ${missing.join(", ")}`);
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendGenerationPdfEmail(args: {
  email: string;
  downloadUrl: string;
  title: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  if (!from) {
    throw new Error("SMTP_FROM and SMTP_USER are missing.");
  }
  const normalizedUrl = args.downloadUrl.trim();
  const downloadUrl = /^https?:\/\//i.test(normalizedUrl)
    ? normalizedUrl
    : `${getSiteUrl()}/${normalizedUrl.replace(/^\/+/, "")}`;
  const safeDownloadUrl = downloadUrl.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${args.title} PDF is ready`,
    text: `Your generated PDF is ready.\n\nDownload: ${downloadUrl}\n`,
    html: `<p>Your generated PDF is ready.</p><p><a href="${safeDownloadUrl}">Download PDF</a></p>`,
  });
}

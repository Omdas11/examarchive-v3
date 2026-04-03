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
  if (!host || !user || !pass || !Number.isFinite(port)) {
    throw new Error("SMTP is not fully configured.");
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
  downloadPath: string;
  title: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error("SMTP_FROM or SMTP_USER must be configured.");
  }
  const normalizedPath = args.downloadPath.startsWith("/")
    ? args.downloadPath
    : `/${args.downloadPath.replace(/^\/+/, "")}`;
  const downloadUrl = `${getSiteUrl()}${normalizedPath}`;

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${args.title} PDF is ready`,
    text: `Your generated PDF is ready.\n\nDownload: ${downloadUrl}\n`,
    html: `<p>Your generated PDF is ready.</p><p><a href="${downloadUrl}">Download PDF</a></p>`,
  });
}

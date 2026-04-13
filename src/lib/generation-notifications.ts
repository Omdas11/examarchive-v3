import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export class SmtpConfigurationError extends Error {}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
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
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.examarchive.dev"
  ).replace(/\/+$/, "");
}

let cachedTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;
let transporterInitPromise: Promise<nodemailer.Transporter<SMTPTransport.SentMessageInfo>> | null = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (transporterInitPromise) return transporterInitPromise;

  transporterInitPromise = (async () => {
    const gmailAddress = process.env.GMAIL_EMAIL_ADDRESS;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    const missing: string[] = [];
    if (!gmailAddress) missing.push("GMAIL_EMAIL_ADDRESS");
    if (!gmailAppPassword) missing.push("GMAIL_APP_PASSWORD");
    if (missing.length > 0) {
      throw new SmtpConfigurationError(`Gmail configuration incomplete: missing ${missing.join(", ")}`);
    }
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailAddress, pass: gmailAppPassword },
    });
    return cachedTransporter;
  })().catch((error) => {
    cachedTransporter = null;
    throw error;
  }).finally(() => {
    transporterInitPromise = null;
  });

  return transporterInitPromise;
}

export async function sendGenerationPdfEmail(args: {
  email: string;
  downloadUrl: string;
  title: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = (process.env.GMAIL_EMAIL_ADDRESS || "").trim();
  if (!from) {
    throw new SmtpConfigurationError("GMAIL_EMAIL_ADDRESS is missing.");
  }
  const normalizedUrl = args.downloadUrl.trim();
  const downloadUrl = /^https?:\/\//i.test(normalizedUrl)
    ? normalizedUrl
    : `${getSiteUrl()}/${normalizedUrl.replace(/^\/+/, "")}`;
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${args.title} PDF is ready`,
    text: `Your generated PDF is ready.\n\nDownload: ${downloadUrl}\n`,
    html: `<p>Your generated PDF is ready.</p><p><a href="${safeDownloadUrl}">Download PDF</a></p>`,
  });
}

export async function sendGenerationFailureEmail(args: {
  email: string;
  title: string;
  reason?: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = (process.env.GMAIL_EMAIL_ADDRESS || "").trim();
  if (!from) {
    throw new SmtpConfigurationError("GMAIL_EMAIL_ADDRESS is missing.");
  }
  const reason = (
    args.reason ||
    "Generation failed. Please check your selections and try again. If it keeps failing, contact support."
  ).trim();
  const safeReason = escapeHtml(reason);
  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${args.title} generation failed`,
    text: `We couldn't complete your PDF generation request.\n\nReason: ${reason}\nPlease try again.\n`,
    html: `<p>We couldn't complete your PDF generation request.</p><p><strong>Reason:</strong> ${safeReason}</p><p>Please try again.</p>`,
  });
}

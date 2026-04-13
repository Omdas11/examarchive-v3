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

/**
 * Normalizes plain-text user-provided fragments for email text bodies by stripping
 * control whitespace that can break formatting or be abused for header-style injection.
 */
function sanitizePlainText(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.examarchive.dev"
  ).replace(/\/+$/, "");
}

function getFromAddress(): string {
  const fromAddress = (
    process.env.GMAIL_FROM_ADDRESS ||
    process.env.MAIL_FROM_ADDRESS ||
    process.env.GMAIL_EMAIL_ADDRESS ||
    ""
  ).trim();
  if (!fromAddress) {
    throw new SmtpConfigurationError("GMAIL_EMAIL_ADDRESS is missing.");
  }
  return fromAddress;
}

function normalizeGmailAppPassword(value: string): string {
  const compact = value.replace(/[\s-]+/g, "");
  if (!/^[a-zA-Z0-9]{16}$/.test(compact)) {
    throw new SmtpConfigurationError(
      "GMAIL_APP_PASSWORD must be a 16-character Gmail App Password (spaces or hyphens are allowed).",
    );
  }
  return compact;
}

let cachedTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;
let transporterInitPromise: Promise<nodemailer.Transporter<SMTPTransport.SentMessageInfo>> | null = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (transporterInitPromise) return transporterInitPromise;

  transporterInitPromise = (async () => {
    const gmailAddress = process.env.GMAIL_EMAIL_ADDRESS;
    const gmailAppPasswordRaw = process.env.GMAIL_APP_PASSWORD;
    if (!gmailAddress || !gmailAppPasswordRaw) {
      const missing: string[] = [];
      if (!gmailAddress) missing.push("GMAIL_EMAIL_ADDRESS");
      if (!gmailAppPasswordRaw) missing.push("GMAIL_APP_PASSWORD");
      throw new SmtpConfigurationError(`Gmail configuration incomplete: missing ${missing.join(", ")}`);
    }
    const gmailAppPassword = normalizeGmailAppPassword(gmailAppPasswordRaw);
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

export async function sendGenerationStartedEmail(args: {
  email: string;
  title: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = getFromAddress();
  const safeTitle = sanitizePlainText(args.title) || "PDF generation request";
  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${safeTitle} generation started`,
    text: `Your request has been accepted and generation has started.\n\nTitle: ${safeTitle}\nYou will receive another email when the PDF is ready, or if generation fails.\n`,
    html: "<p>Your PDF generation request has been accepted and generation has started.</p><p>You will receive another email when the PDF is ready, or if generation fails.</p>",
  });
}

export async function sendGenerationPdfEmail(args: {
  email: string;
  downloadUrl: string;
  title: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = getFromAddress();
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
  const from = getFromAddress();
  const safeTitle = sanitizePlainText(args.title) || "PDF generation request";
  const reason = (
    args.reason ||
    "Generation failed. Please check your selections and try again. If it keeps failing, contact support."
  ).trim();
  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${safeTitle} generation failed`,
    text: `We couldn't complete your PDF generation request.\n\nTitle: ${safeTitle}\nReason: ${reason}\n\nWhat you can do:\n- Try again in a few minutes.\n- If the issue persists, contact support and include this reason.\n`,
    html: "<p>We couldn't complete your PDF generation request.</p><p>Please try again in a few minutes. If the issue persists, contact support and include the detailed reason shown in the plain-text section of this email.</p>",
  });
}

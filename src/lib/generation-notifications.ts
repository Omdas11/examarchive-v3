import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import sanitizeHtml from "sanitize-html";

export class SmtpConfigurationError extends Error {}
const DEFAULT_SMTP_PORT = 587;
const SMTP_SECURE_PORT = 465;

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

function sanitizeEmailHtmlInput(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).replace(/\u0000/g, "").trim();
}

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.examarchive.dev"
  ).replace(/\/+$/, "");
}

function toSafeHttpUrl(rawUrl: string): string {
  const siteUrl = getSiteUrl();
  const normalized = rawUrl.trim();
  if (!normalized) return siteUrl;
  try {
    const url = /^https?:\/\//i.test(normalized)
      ? new URL(normalized)
      : new URL(normalized.replace(/^\/+/, ""), `${siteUrl}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return siteUrl;
    return url.toString();
  } catch {
    return siteUrl;
  }
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

function parseSmtpPort(value: string | undefined): number {
  const parsed = Number(value ?? DEFAULT_SMTP_PORT);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new SmtpConfigurationError("SMTP_PORT must be a valid integer between 1 and 65535.");
  }
  return parsed;
}

function parseSmtpSecure(value: string | undefined, port: number): boolean {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return port === SMTP_SECURE_PORT;
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

let cachedTransporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;
let transporterInitPromise: Promise<nodemailer.Transporter<SMTPTransport.SentMessageInfo>> | null = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (transporterInitPromise) return transporterInitPromise;

  transporterInitPromise = (async () => {
    const smtpHost = (process.env.SMTP_HOST || "").trim();
    if (smtpHost) {
      const smtpPort = parseSmtpPort(process.env.SMTP_PORT);
      const smtpSecure = parseSmtpSecure(process.env.SMTP_SECURE, smtpPort);
      const smtpUser = (process.env.SMTP_USER || "").trim();
      const smtpPass = (process.env.SMTP_PASS || process.env.RESEND_API_KEY || "").trim();
      if (!smtpUser || !smtpPass) {
        const missing: string[] = [];
        if (!smtpUser) missing.push("SMTP_USER");
        if (!smtpPass) missing.push("SMTP_PASS/RESEND_API_KEY");
        throw new SmtpConfigurationError(`SMTP configuration incomplete: missing ${missing.join(", ")}`);
      }
      cachedTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });
      return cachedTransporter;
    }

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
  const safeTitle = sanitizePlainText(args.title) || "PDF generation request";
  const downloadUrl = toSafeHttpUrl(args.downloadUrl);
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${safeTitle} PDF is ready`,
    text: `Your generated PDF is ready.\n\nDownload: ${downloadUrl}\n`,
    html: `<p>Your generated PDF is ready.</p><p><a href="${safeDownloadUrl}">Download PDF</a></p>`,
  });
}

export async function sendGenerationFailureEmail(args: {
  email: string;
  title: string;
  reason?: string;
  diagnostics?: string;
}): Promise<void> {
  const to = args.email.trim();
  if (!to) return;
  const from = getFromAddress();
  const safeTitle = sanitizePlainText(args.title) || "PDF generation request";
  const reasonRaw = (
    args.reason ||
    "Generation failed. Please check your selections and try again. If it keeps failing, contact support."
  );
  const diagnosticsRaw = (args.diagnostics || "").slice(0, 8_000);
  const reasonText = sanitizePlainText(sanitizeEmailHtmlInput(reasonRaw));
  const diagnosticsTextValue = sanitizePlainText(sanitizeEmailHtmlInput(diagnosticsRaw));
  const reasonHtml = escapeHtml(sanitizeEmailHtmlInput(reasonRaw));
  const diagnosticsHtmlValue = escapeHtml(sanitizeEmailHtmlInput(diagnosticsRaw));
  const diagnosticsText = diagnosticsTextValue ? `\nDiagnostics:\n${diagnosticsTextValue}\n` : "";
  const diagnosticsHtml = diagnosticsHtmlValue
    ? `<p><strong>Diagnostics</strong></p><pre>${diagnosticsHtmlValue}</pre>`
    : "";
  const transporter = await getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `ExamArchive: ${safeTitle} generation failed`,
    text: `We couldn't complete your PDF generation request.\n\nTitle: ${safeTitle}\nReason: ${reasonText}${diagnosticsText}\nWhat you can do:\n- Try again in a few minutes.\n- If the issue persists, contact support and include the reason and diagnostics from this email.\n`,
    html: `<p>We couldn't complete your PDF generation request.</p><p><strong>Reason:</strong> ${reasonHtml}</p>${diagnosticsHtml}<p>Please try again in a few minutes. If the issue persists, contact support and include these details.</p>`,
  });
}

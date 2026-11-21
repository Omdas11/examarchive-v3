/**
 * Send email through the Resend HTTP API (plain fetch — works on
 * Cloudflare Workers, where SMTP is unavailable).
 *
 * Needs the RESEND_API_KEY Worker secret. When it is missing the send
 * fails with a clear error instead of silently dropping the mail; the
 * caller must not treat the action as done in that case.
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "ExamArchive <noreply@examarchive.dev>";

export class ResendConfigurationError extends Error {}

function getResendApiKey(): string {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    throw new ResendConfigurationError(
      "RESEND_API_KEY is not set on this Worker.",
    );
  }
  return key;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return ch;
    }
  });
}

export async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const apiKey = getResendApiKey();
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [args.to.trim()],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Resend rejected the email (${res.status}): ${detail}`);
  }
}

/**
 * The MD verification upload code email. The code is 6 characters, valid
 * 24 hours, single-use. The mail says plainly to check spam and mark it
 * as not spam if it lands there — Resend mail from a new domain often
 * does on first receipt.
 */
export async function sendVerificationCodeEmail(args: {
  email: string;
  code: string;
}): Promise<void> {
  const to = args.email.trim().toLowerCase();
  const code = args.code;
  await sendEmailViaResend({
    to,
    subject: "Your ExamArchive upload code",
    text:
      `Your ExamArchive upload code is: ${code}\n\n` +
      `It works once, for the next 24 hours. Enter it on the upload form at https://examarchive.dev/admin/md-verification/upload together with your zip file.\n\n` +
      `If this email landed in spam, please mark it as not spam so future codes reach your inbox.\n\n` +
      `If you did not ask for a code, ignore this email.\n`,
    html:
      `<p>Your ExamArchive upload code is: <strong style="font-size:20px;letter-spacing:0.15em;">${escapeHtml(code)}</strong></p>` +
      `<p>It works once, for the next 24 hours. Enter it on the upload form together with your zip file.</p>` +
      `<p>If this email landed in spam, please mark it as not spam so future codes reach your inbox.</p>` +
      `<p>If you did not ask for a code, ignore this email.</p>`,
  });
}

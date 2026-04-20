import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNED_DOWNLOAD_DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SIGNED_TOKEN_HEX_LENGTH = 64;
const MAX_SIGNED_TOKEN_INPUT_LENGTH = 256;
const SIGNED_TOKEN_PATTERN = new RegExp(`^[a-f0-9]{${SIGNED_TOKEN_HEX_LENGTH}}$`, "i");

let unsignedUrlWarningEmitted = false;
let missingUserIdWarningEmitted = false;

function getDownloadSigningSecret(): string | null {
  const raw = process.env.PDF_DOWNLOAD_TOKEN_SECRET;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function emitUnsignedUrlWarning(context: { fileId: string; userId: string; env: string }): void {
  if (unsignedUrlWarningEmitted) return;
  unsignedUrlWarningEmitted = true;
  if (process.env.NODE_ENV !== "test") {
    console.warn("[pdf-download-link] PRODUCTION WARNING: PDF_DOWNLOAD_TOKEN_SECRET is missing or empty. Unsigned download URLs will be returned, which may cause silent redirects for signed-out recipients.", {
      env: context.env,
      fileIdSample: context.fileId.slice(0, 8),
      hasUserId: Boolean(context.userId),
    });
  }
}

function emitMissingUserIdWarning(context: { fileId: string; env: string }): void {
  if (missingUserIdWarningEmitted) return;
  missingUserIdWarningEmitted = true;
  if (process.env.NODE_ENV !== "test") {
    console.warn("[pdf-download-link] Signed download token requested without userId; returning unsigned URL.", {
      env: context.env,
      fileIdSample: context.fileId.slice(0, 8),
    });
  }
}

function signPayload(secret: string, fileId: string, userId: string, expires: number): string {
  return createHmac("sha256", secret)
    .update(`${fileId}:${userId}:${expires}`)
    .digest("hex");
}

export function buildSignedPdfDownloadPath(args: {
  fileId: string;
  userId: string;
  ttlSeconds?: number;
}): string {
  const fileId = String(args.fileId || "").trim();
  const userId = String(args.userId || "").trim();
  if (!fileId) return "";

  const params = new URLSearchParams();
  params.set("download", "1");

  const secret = getDownloadSigningSecret();
  if (secret && userId) {
    const ttl = Number.isFinite(args.ttlSeconds)
      ? Math.max(60, Math.floor(Number(args.ttlSeconds)))
      : SIGNED_DOWNLOAD_DEFAULT_TTL_SECONDS;
    const expires = Math.floor(Date.now() / 1000) + ttl;
    params.set("uid", userId);
    params.set("exp", String(expires));
    params.set("token", signPayload(secret, fileId, userId, expires));
  } else if (!secret) {
    emitUnsignedUrlWarning({
      fileId,
      userId,
      env: process.env.NODE_ENV || "unknown",
    });
  } else {
    emitMissingUserIdWarning({
      fileId,
      env: process.env.NODE_ENV || "unknown",
    });
  }
  params.set("t", String(Date.now()));

  return `/api/files/papers/${encodeURIComponent(fileId)}?${params.toString()}`;
}

export function isValidSignedPdfDownloadToken(args: {
  fileId: string;
  userId: string;
  expires: string;
  token: string;
}): boolean {
  const fileId = String(args.fileId || "").trim();
  const userId = String(args.userId || "").trim();
  const token = String(args.token || "").trim();
  const expires = Number(args.expires);
  const secret = getDownloadSigningSecret();
  if (!secret || !fileId || !userId || !token) return false;
  if (fileId.length > MAX_SIGNED_TOKEN_INPUT_LENGTH || userId.length > MAX_SIGNED_TOKEN_INPUT_LENGTH) return false;
  if (!SIGNED_TOKEN_PATTERN.test(token)) return false;
  if (!Number.isFinite(expires)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const expected = signPayload(secret, fileId, userId, expires);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

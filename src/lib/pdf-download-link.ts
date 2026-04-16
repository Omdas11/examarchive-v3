import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNED_DOWNLOAD_DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getDownloadSigningSecret(): string {
  return String(process.env.PDF_DOWNLOAD_TOKEN_SECRET || process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
}

function signPayload(fileId: string, userId: string, expires: number): string {
  return createHmac("sha256", getDownloadSigningSecret())
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
    params.set("token", signPayload(fileId, userId, expires));
  }

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
  const token = String(args.token || "").trim().toLowerCase();
  const expires = Number(args.expires);
  const secret = getDownloadSigningSecret();
  if (!secret || !fileId || !userId || !token) return false;
  if (!Number.isFinite(expires)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;

  const expected = signPayload(fileId, userId, expires);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

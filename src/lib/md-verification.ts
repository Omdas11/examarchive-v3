/**
 * MD verification — pure helpers (no D1 / auth imports).
 *
 * Kept free of Cloudflare bindings on purpose so the jest tests can
 * import this module without a Worker context. Anything that touches D1
 * lives in md-verification-access.ts and in the route handlers.
 *
 * Rules encoded here:
 * - Paper codes are normalised to upper-case, spaces stripped. A code is
 *   valid when it is 5-20 chars of letters, digits and hyphens starting
 *   with a letter (covers PHYDSC401T, COM-DSC-301T, UNIVAC-101T).
 * - Upload access codes are never stored raw: only the SHA-256 hex of
 *   the code is stored in D1 (md_upload_tokens.token_hash). The raw code
 *   is shown once at creation.
 * - Upload limits: PDF max 25 MB, md max 2 MB, default 50 uploads per
 *   token per UTC day.
 */

export const MD_VERIFICATION_STATUSES = [
  "pending",
  "in_review",
  "needs_fix",
  "approved",
] as const;
export type MdVerificationStatus = (typeof MD_VERIFICATION_STATUSES)[number];

export const MD_VERIFICATION_TYPES = ["question", "syllabus"] as const;
export type MdVerificationType = (typeof MD_VERIFICATION_TYPES)[number];

export const MD_VERIFICATION_PAGE_SIZE = 20;
export const MD_MAX_BYTES = 2 * 1024 * 1024;
export const PDF_MAX_BYTES = 25 * 1024 * 1024;

/**
 * XP for completing a full md, awarded once when an item is approved.
 * Same size as the site's moderator-accepted correction bonus
 * (CORRECTION_BONUS_XP / CORRECTION_BONUS_CREDITS in verify.ts) and,
 * like that bonus, it bypasses the daily verify caps. No XP for
 * needs_fix, Save draft, or Submit alone.
 */
export const MD_COMPLETION_XP = 25;
export const MD_COMPLETION_CREDITS = 5;

/**
 * Emailed upload codes (replace the revoked X-Upload-Code tokens).
 * A code is 6 characters from an unambiguous alphabet (no 0/O/1/I/L),
 * single-use, valid 24 hours, dead after 3 wrong attempts. Only the
 * SHA-256 hash is stored (see hashUploadCode, shared with the old
 * tokens). The raw code is never stored and never returned by any API.
 */
export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 3;
export const VERIFICATION_CODE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cryptographically random 6-char upload code (see above). */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(VERIFICATION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) {
    code += VERIFICATION_CODE_ALPHABET[b % VERIFICATION_CODE_ALPHABET.length];
  }
  return code;
}

export interface UploadCodeState {
  used_at: number | null;
  revoked_at: number | null;
  expires_at: number;
  attempts: number;
}

/**
 * Why a stored upload code cannot be used right now, or null when it
 * can. Pure, so the rule is unit-testable without D1.
 */
export function uploadCodeBlockedReason(
  code: UploadCodeState,
  now = Date.now(),
): string | null {
  if (code.used_at !== null) return "This code was already used";
  if (code.revoked_at !== null) return "This code was revoked";
  if (now >= code.expires_at) return "This code has expired";
  if (code.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS)
    return "Too many wrong attempts — this code no longer works";
  return null;
}

/** One file inside an uploaded zip (name + uncompressed size). */
export interface ZipEntryInfo {
  name: string;
  size: number;
}

/** True for zip entries that are packaging noise, not content. */
function isZipNoiseEntry(name: string): boolean {
  return (
    name.startsWith("__MACOSX/") ||
    name.endsWith("/.DS_Store") ||
    name === ".DS_Store"
  );
}

/**
 * Validate the contents of an upload zip: exactly one PDF and exactly
 * one md file (ignoring macOS noise entries), within the size limits.
 * Returns the file names, or an error message.
 */
export function validateZipEntries(
  entries: ZipEntryInfo[],
): { pdfName: string; mdName: string } | { error: string } {
  const files = entries.filter(
    (e) => !e.name.endsWith("/") && !isZipNoiseEntry(e.name),
  );
  if (files.length === 0) return { error: "The zip is empty" };
  const pdfs = files.filter((e) => e.name.toLowerCase().endsWith(".pdf"));
  const mds = files.filter(
    (e) =>
      e.name.toLowerCase().endsWith(".md") ||
      e.name.toLowerCase().endsWith(".markdown"),
  );
  if (pdfs.length === 0) return { error: "The zip must contain one PDF file" };
  if (pdfs.length > 1)
    return { error: "The zip must contain exactly one PDF file" };
  if (mds.length === 0)
    return { error: "The zip must contain one markdown (.md) file" };
  if (mds.length > 1)
    return { error: "The zip must contain exactly one markdown (.md) file" };
  const pdf = pdfs[0];
  const md = mds[0];
  if (pdf.size > PDF_MAX_BYTES) return { error: "PDF exceeds the 25 MB limit" };
  if (md.size > MD_MAX_BYTES) return { error: "md text exceeds the 2 MB limit" };
  const extra = files.filter((e) => e !== pdf && e !== md);
  if (extra.length > 0) {
    return {
      error: `The zip must contain only one PDF and one md file (unexpected: ${extra
        .map((e) => e.name)
        .slice(0, 3)
        .join(", ")})`,
    };
  }
  return { pdfName: pdf.name, mdName: md.name };
}

export const STATUS_LABELS: Record<MdVerificationStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  needs_fix: "Needs fix",
  approved: "Approved",
};

/** One verification queue item, as returned by the API. */
export interface MdVerificationItem {
  id: string;
  paper_code: string;
  type: MdVerificationType;
  batch_id: string;
  status: MdVerificationStatus;
  md_text: string;
  pdf_key: string | null;
  submitted_by: string | null;
  submitted_via: "manual" | "upload";
  assigned_to: string | null;
  edited_by: string | null;
  edited_at: number | null;
  verified_by: string | null;
  verified_at: number | null;
  note: string | null;
  /** XP awarded on approval (0 until awarded). */
  xp_awarded: number;
  /** User id the completion XP went to, null until awarded. */
  xp_awarded_to: string | null;
  created_at: number;
  updated_at: number;
  /** Length of md_text in chars (list view only, avoids fetching the text). */
  md_chars?: number;
}

export function isMdVerificationStatus(
  value: unknown,
): value is MdVerificationStatus {
  return (
    typeof value === "string" &&
    (MD_VERIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isMdVerificationType(
  value: unknown,
): value is MdVerificationType {
  return (
    typeof value === "string" &&
    (MD_VERIFICATION_TYPES as readonly string[]).includes(value)
  );
}

/** Upper-case, strip spaces. Returns "" for non-strings. */
export function normalizePaperCodeInput(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/** Paper-code format check (after normalisation). */
export function isValidPaperCode(value: unknown): boolean {
  const code = normalizePaperCodeInput(value);
  return /^[A-Z][A-Z0-9-]{4,19}$/.test(code);
}

/** Clamp a caller-supplied page number into a safe range. */
export function clampPage(value: unknown, max = 1000): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), max);
}

/** SHA-256 hex of an upload code — what D1 stores. */
export async function hashUploadCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Timing-safe compare for two SHA-256 hex strings. Imported from
 * node:crypto by callers that run on the server; the pure helper itself
 * takes precomputed hex strings.
 */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface UploadValidationInput {
  paperCode: unknown;
  type: unknown;
  batchId: unknown;
  mdText: unknown;
  pdfSize: number | null;
  pdfName: string | null;
}

/** Validate one upload call (before any D1/R2 work). Returns an error
 * message, or null when the input is valid. */
export function validateUploadInput(input: UploadValidationInput): string | null {
  if (!isValidPaperCode(input.paperCode)) {
    return "Invalid paper_code";
  }
  if (!isMdVerificationType(input.type)) {
    return "Invalid type: expected question or syllabus";
  }
  if (
    input.batchId !== undefined &&
    input.batchId !== null &&
    (typeof input.batchId !== "string" ||
      input.batchId.trim().length === 0 ||
      input.batchId.length > 80)
  ) {
    return "Invalid batch_id";
  }
  if (typeof input.mdText !== "string" || input.mdText.trim().length === 0) {
    return "md text is required";
  }
  if (input.mdText.length > MD_MAX_BYTES) {
    return "md text exceeds the 2 MB limit";
  }
  if (input.pdfSize !== null) {
    if (input.pdfSize > PDF_MAX_BYTES) {
      return "PDF exceeds the 25 MB limit";
    }
    if (input.pdfName && !input.pdfName.toLowerCase().endsWith(".pdf")) {
      return "PDF file must have a .pdf extension";
    }
  }
  return null;
}

export interface MdCompletionCandidate {
  status: string;
  xp_awarded?: number | null;
  xp_awarded_to?: string | null;
  edited_by?: string | null;
  submitted_by?: string | null;
  assigned_to?: string | null;
}

/**
 * True when approving this item should award completion XP: the item
 * is not already approved and no XP has been awarded for it yet. The
 * status check is the transition guard (approve is only an award on
 * the move into approved); xp_awarded is the once-only guard.
 */
export function shouldAwardMdXp(item: MdCompletionCandidate): boolean {
  return item.status !== "approved" && (item.xp_awarded ?? 0) === 0;
}

/**
 * Who earns the completion XP: the person who finished the md
 * (edited_by), else who submitted it, else who it was assigned to,
 * else the approver. Returns null when nobody is identifiable.
 * Self-approve earns the XP once — intentional, the founder tries the
 * first item himself.
 */
export function resolveMdCompleter(
  item: MdCompletionCandidate,
  approverId: string,
): string | null {
  for (const candidate of [
    item.edited_by,
    item.submitted_by,
    item.assigned_to,
    approverId,
  ]) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

/** R2 object key for an uploaded verification PDF. Private by default:
 * the bucket is not public; PDFs are served only through the
 * verifier-gated /api/md-verification/[id]/pdf route. */
export function verificationPdfKey(batchId: string, itemId: string): string {
  const safeBatch = batchId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return `md-verification/${safeBatch || "manual"}/${itemId}.pdf`;
}

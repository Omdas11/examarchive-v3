import { NextResponse, type NextRequest } from "next/server";
import { unzipSync } from "fflate";
import { getServerUser } from "@/lib/auth-cf";
import { getD1, getPapersBucket } from "@/lib/d1";
import {
  addMdHistory,
  canUploadMdVerification,
} from "@/lib/md-verification-access";
import {
  VERIFICATION_CODE_MAX_ATTEMPTS,
  hashUploadCode,
  hashesEqual,
  normalizePaperCodeInput,
  uploadCodeBlockedReason,
  validateUploadInput,
  validateZipEntries,
  verificationPdfKey,
  type UploadCodeState,
} from "@/lib/md-verification";

export const dynamic = "force-dynamic";

/** Hard caps on what one zip may expand to (zip-bomb guard). */
const MAX_ZIP_ENTRIES = 50;
const MAX_ZIP_TOTAL_BYTES = 30 * 1024 * 1024;

/**
 * POST /api/md-verification/upload — one item per call, from the
 * signed-in upload form. No upload codes in headers any more: auth is
 * the site session plus a 6-char code emailed to the uploader.
 *
 * Multipart form fields:
 *   zip (required) — one zip with exactly one PDF + one md file,
 *   paper_code (required), type (question | syllabus, required),
 *   batch_id (optional, groups a batch), code (required, the emailed
 *   6-char code, single-use, 24 h, dead after 3 wrong attempts).
 *
 * The code must belong to the signed-in user's email. The PDF goes to
 * R2 under md-verification/ (private bucket, verifier-gated serving
 * only); the md text goes to D1 and the item is created as pending.
 *
 * Errors: 401 guest / no valid code / wrong code, 403 signed-in but
 * not allowed to upload, 409 duplicate paper in this batch, 400
 * validation, 413 oversize file.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  if (!(await canUploadMdVerification(user))) {
    return NextResponse.json(
      { error: "Your account cannot upload verification items" },
      { status: 403 },
    );
  }
  const email = (user.email || "").trim().toLowerCase();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
      { status: 400 },
    );
  }

  const codeRaw = form.get("code");
  const code =
    typeof codeRaw === "string" ? codeRaw.trim().toUpperCase() : "";
  if (!code) {
    return NextResponse.json(
      { error: "Enter the 6-character code emailed to you" },
      { status: 401 },
    );
  }

  const zipField = form.get("zip");
  const zipFile = zipField instanceof File ? zipField : null;
  if (!zipFile) {
    return NextResponse.json(
      { error: "Attach the zip file with the PDF and md" },
      { status: 400 },
    );
  }

  const paperCode = normalizePaperCodeInput(form.get("paper_code"));
  const type = form.get("type");
  const batchRaw = form.get("batch_id");
  const batchId =
    typeof batchRaw === "string" && batchRaw.trim().length > 0
      ? batchRaw.trim().slice(0, 80)
      : `upload-${new Date().toISOString().slice(0, 10)}`;

  // --- Verify the emailed code (belongs to this user's email) ---
  let codeRow: (UploadCodeState & { id: string }) | null = null;
  try {
    const db = await getD1();
    codeRow = await db
      .prepare(
        "SELECT id, used_at, revoked_at, expires_at, attempts FROM md_upload_codes " +
          "WHERE email = ? AND used_at IS NULL AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
      )
      .bind(email)
      .first<UploadCodeState & { id: string }>();
  } catch {
    return NextResponse.json(
      { error: "Could not check the upload code" },
      { status: 500 },
    );
  }
  if (!codeRow) {
    return NextResponse.json(
      { error: "No valid code for your account — ask an admin to send you one" },
      { status: 401 },
    );
  }
  const blocked = uploadCodeBlockedReason(codeRow);
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 401 });
  }
  const codeMatches = await verifyCode(code, codeRow.id);
  if (!codeMatches) {
    try {
      const db = await getD1();
      await db
        .prepare("UPDATE md_upload_codes SET attempts = attempts + 1 WHERE id = ?")
        .bind(codeRow.id)
        .run();
    } catch {
      // Attempt counting must never block the error itself.
    }
    const remaining =
      VERIFICATION_CODE_MAX_ATTEMPTS - (codeRow.attempts + 1);
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Wrong code — ${remaining} attempt${remaining === 1 ? "" : "s"} left`
            : "Wrong code — this code no longer works, ask an admin to send a new one",
      },
      { status: 401 },
    );
  }

  // --- Unzip and validate contents ---
  let pdfBytes: Uint8Array;
  let mdText: string;
  let pdfName: string;
  try {
    const bytes = new Uint8Array(await zipFile.arrayBuffer());
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      return NextResponse.json(
        { error: "Could not open the zip file" },
        { status: 400 },
      );
    }
    const names = Object.keys(entries);
    if (names.length > MAX_ZIP_ENTRIES) {
      return NextResponse.json(
        { error: "The zip has too many files" },
        { status: 400 },
      );
    }
    const total = names.reduce((sum, n) => sum + entries[n].length, 0);
    if (total > MAX_ZIP_TOTAL_BYTES) {
      return NextResponse.json(
        { error: "The zip is too large when unpacked" },
        { status: 413 },
      );
    }
    const checked = validateZipEntries(
      names.map((n) => ({ name: n, size: entries[n].length })),
    );
    if ("error" in checked) {
      return NextResponse.json({ error: checked.error }, { status: 400 });
    }
    pdfName = checked.pdfName;
    pdfBytes = entries[checked.pdfName];
    try {
      mdText = new TextDecoder("utf-8", { fatal: true }).decode(
        entries[checked.mdName],
      );
    } catch {
      return NextResponse.json(
        { error: "The md file is not valid UTF-8 text" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read the zip file" },
      { status: 400 },
    );
  }

  const error = validateUploadInput({
    paperCode,
    type,
    batchId,
    mdText,
    pdfSize: pdfBytes.length,
    pdfName,
  });
  if (error) {
    const status = error.includes("exceeds") ? 413 : 400;
    return NextResponse.json({ error }, { status });
  }

  // --- Store: R2 PDF + D1 item, then burn the code ---
  try {
    const db = await getD1();
    const now = Date.now();

    const dupe = await db
      .prepare(
        "SELECT id FROM md_verification_items WHERE paper_code = ? AND type = ? AND batch_id = ? AND status IN ('pending', 'in_review', 'approved') LIMIT 1",
      )
      .bind(paperCode, type, batchId)
      .first<{ id: string }>();
    if (dupe) {
      return NextResponse.json(
        { error: "This paper was already uploaded in this batch", id: dupe.id },
        { status: 409 },
      );
    }

    const itemId = crypto.randomUUID();
    const pdfKey = verificationPdfKey(batchId, itemId);
    const bucket = await getPapersBucket();
    await bucket.put(pdfKey, pdfBytes, {
      httpMetadata: { contentType: "application/pdf" },
    });

    // One D1 batch: the item and the spent code land together, so a
    // code can never be reused even if the request is retried.
    // upload_token_id reuses the old column name; it now holds the
    // md_upload_codes row id (audit trail for which code was used).
    await db.batch([
      db
        .prepare(
          "INSERT INTO md_verification_items (id, paper_code, type, batch_id, status, md_text, pdf_key, submitted_by, submitted_via, upload_token_id, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 'upload', ?, ?, ?)",
        )
        .bind(
          itemId,
          paperCode,
          type,
          batchId,
          mdText,
          pdfKey,
          user.id,
          codeRow.id,
          now,
          now,
        ),
      db
        .prepare("UPDATE md_upload_codes SET used_at = ? WHERE id = ?")
        .bind(now, codeRow.id),
    ]);
    await addMdHistory({
      itemId,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: "created",
      note: `Uploaded via emailed code, batch ${batchId}`,
    });

    return NextResponse.json(
      {
        id: itemId,
        paper_code: paperCode,
        type,
        batch_id: batchId,
        status: "pending",
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("R2")) {
      return NextResponse.json(
        { error: "Could not store the PDF" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Could not create the verification item" },
      { status: 500 },
    );
  }
}

/**
 * Compare the entered code against the stored hash. The hash is
 * fetched by code id so a wrong guess cannot be checked against a
 * different row.
 */
async function verifyCode(code: string, codeId: string): Promise<boolean> {
  const db = await getD1();
  const row = await db
    .prepare("SELECT code_hash FROM md_upload_codes WHERE id = ? LIMIT 1")
    .bind(codeId)
    .first<{ code_hash: string }>();
  if (!row) return false;
  return hashesEqual(await hashUploadCode(code), row.code_hash);
}

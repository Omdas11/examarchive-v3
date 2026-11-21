import { NextResponse, type NextRequest } from "next/server";
import { getD1, getPapersBucket } from "@/lib/d1";
import { addMdHistory } from "@/lib/md-verification-access";
import {
  hashUploadCode,
  normalizePaperCodeInput,
  validateUploadInput,
  verificationPdfKey,
} from "@/lib/md-verification";

export const dynamic = "force-dynamic";

/**
 * POST /api/md-verification/upload — one item per call, for the friend's
 * IDE AI. No site login is needed; auth is the upload code in the
 * X-Upload-Code header. The code is stored only as a SHA-256 hash in D1.
 *
 * Multipart form fields:
 *   paper_code (required), type (question | syllabus, required),
 *   batch_id (optional, groups a batch of 5), md (text) or md_file (file),
 *   pdf (file, optional — the official PDF the md was extracted from).
 *
 * Limits: PDF max 25 MB, md max 2 MB. One item per call. The PDF goes to
 * R2 under md-verification/ (private bucket, verifier-gated serving
 * only); the md text goes to D1 and the item is created as pending.
 *
 * Errors: 401 bad / expired / revoked code, 429 over the token's daily
 * cap, 409 when the same paper_code + type + batch was already uploaded
 * and is still pending / in review / approved, 400 validation, 413
 * oversize file.
 */
export async function POST(request: NextRequest) {
  const code = request.headers.get("x-upload-code") ?? "";
  if (!code) {
    return NextResponse.json(
      { error: "Missing upload code" },
      { status: 401 },
    );
  }

  let token: {
    id: string;
    daily_cap: number;
  } | null = null;
  try {
    const db = await getD1();
    const tokenHash = await hashUploadCode(code);
    token = await db
      .prepare(
        "SELECT id, daily_cap FROM md_upload_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1",
      )
      .bind(tokenHash, Date.now())
      .first<{ id: string; daily_cap: number }>();
  } catch {
    return NextResponse.json(
      { error: "Could not verify the upload code" },
      { status: 500 },
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "Invalid, expired or revoked upload code" },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data" },
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

  let mdText: string | null = null;
  const mdField = form.get("md");
  if (typeof mdField === "string") mdText = mdField;
  const mdFile = form.get("md_file");
  if (mdText === null && mdFile instanceof File) {
    try {
      mdText = await mdFile.text();
    } catch {
      return NextResponse.json(
        { error: "Could not read the md file" },
        { status: 400 },
      );
    }
  }

  const pdf = form.get("pdf");
  const pdfFile = pdf instanceof File ? pdf : null;

  const error = validateUploadInput({
    paperCode,
    type,
    batchId,
    mdText,
    pdfSize: pdfFile ? pdfFile.size : null,
    pdfName: pdfFile ? pdfFile.name : null,
  });
  if (error) {
    const status = error.includes("exceeds") ? 413 : 400;
    return NextResponse.json({ error }, { status });
  }

  try {
    const db = await getD1();
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const countRes = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM md_verification_items WHERE upload_token_id = ? AND created_at >= ?",
      )
      .bind(token.id, dayStart.getTime())
      .first<{ total: number }>();
    if ((countRes?.total ?? 0) >= token.daily_cap) {
      return NextResponse.json(
        { error: "Daily upload cap reached for this code" },
        { status: 429 },
      );
    }

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
    let pdfKey: string | null = null;
    if (pdfFile) {
      pdfKey = verificationPdfKey(batchId, itemId);
      const bucket = await getPapersBucket();
      await bucket.put(pdfKey, await pdfFile.arrayBuffer(), {
        httpMetadata: { contentType: "application/pdf" },
      });
    }

    await db
      .prepare(
        "INSERT INTO md_verification_items (id, paper_code, type, batch_id, status, md_text, pdf_key, submitted_by, submitted_via, upload_token_id, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 'upload', ?, ?, ?)",
      )
      .bind(
        itemId,
        paperCode,
        type,
        batchId,
        mdText as string,
        pdfKey,
        "upload-code",
        token.id,
        now,
        now,
      )
      .run();
    await addMdHistory({
      itemId,
      actorId: null,
      actorLabel: `upload code ${token.id.slice(0, 8)}`,
      action: "created",
      note: `Uploaded via access code, batch ${batchId}`,
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

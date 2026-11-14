import { NextRequest, NextResponse } from "next/server";
import {
  createTurnstileDownloadToken,
  isValidFileId,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { normalizePaperCode } from "@/lib/syllabus-table";

/**
 * POST /api/turnstile-syllabus
 * Verifies a Cloudflare Turnstile token and returns a short-lived signed
 * URL for a generated syllabus PDF (single-paper or departmental). The
 * token is bound to the paper code, or to `dept-<subjectCode>` for
 * departmental PDFs, and is checked by /api/syllabus/table before serving
 * the PDF.
 * Body: { paperCode?: string, subjectCode?: string, turnstileToken: string }
 */
export async function POST(request: NextRequest) {
  let body: { paperCode?: string; subjectCode?: string; turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paperCode = normalizePaperCode(String(body.paperCode || "").trim());
  const subjectCode = String(body.subjectCode || "").trim().toUpperCase();
  const turnstileToken = String(body.turnstileToken || "").trim();
  if ((!paperCode && !subjectCode) || !turnstileToken) {
    return NextResponse.json(
      { error: "Missing paperCode/subjectCode or turnstileToken." },
      { status: 400 },
    );
  }

  const human = await verifyTurnstileToken(turnstileToken);
  if (!human) {
    return NextResponse.json({ error: "Verification failed." }, { status: 403 });
  }

  // The signed scope must match the fileId regex (4-64 alphanumerics).
  const scope = paperCode || `dept-${subjectCode}`;
  if (!isValidFileId(scope)) {
    return NextResponse.json({ error: "Invalid paper code." }, { status: 400 });
  }

  const token = createTurnstileDownloadToken(scope);
  if (!token) {
    return NextResponse.json(
      { error: "Could not issue download token." },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({ mode: "pdf", ctoken: token });
  if (paperCode) params.set("paperCode", paperCode);
  if (subjectCode) params.set("subjectCode", subjectCode);
  return NextResponse.json({ url: `/api/syllabus/table?${params.toString()}` });
}

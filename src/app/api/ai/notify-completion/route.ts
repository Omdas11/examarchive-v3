import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDatabases, COLLECTION, DATABASE_ID } from "@/lib/appwrite";
import { sendGenerationFailureEmail, sendGenerationPdfEmail } from "@/lib/generation-notifications";

type NotifyPayload = {
  jobId?: unknown;
  status?: unknown;
  fileId?: unknown;
};

function safeCompareSecrets(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function getAuthToken(request: NextRequest): string {
  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function getTitleFromPayload(payload: Record<string, unknown>): string {
  const jobType = String(payload.jobType || "").trim().toLowerCase();
  const paperCode = String(payload.paperCode || "").trim();
  if (jobType === "solved-paper") {
    const year = String(payload.year || "").trim();
    return `Solved Paper (${paperCode}${year ? ` ${year}` : ""})`;
  }
  const unitNumber = String(payload.unitNumber || "").trim();
  return `Unit Notes (${paperCode}${unitNumber ? ` - Unit ${unitNumber}` : ""})`;
}

function parseInputPayloadJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = (process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 503 });
  }
  const providedToken = getAuthToken(request);
  if (!providedToken || !safeCompareSecrets(webhookSecret, providedToken)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: NotifyPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobId = String(body.jobId || "").trim();
  const status = String(body.status || "").trim().toLowerCase();
  const fileIdFromBody = String(body.fileId || "").trim();
  if (!jobId || (status !== "completed" && status !== "failed")) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const db = adminDatabases();
  let job;
  try {
    job = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId);
  } catch (error) {
    const status = Number(
      (error as { code?: unknown; status?: unknown; response?: { code?: unknown; status?: unknown } })?.status
      ?? (error as { code?: unknown; status?: unknown; response?: { code?: unknown; status?: unknown } })?.code
      ?? (error as { response?: { code?: unknown; status?: unknown } })?.response?.status
      ?? (error as { response?: { code?: unknown; status?: unknown } })?.response?.code
      ?? NaN,
    );
    if (status === 404) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    console.error("[ai/notify-completion] Failed to load job for webhook callback.", { jobId, error });
    return NextResponse.json({ error: "Unable to process notification callback." }, { status: 500 });
  }
  const payload = parseInputPayloadJson(job.input_payload_json);
  const email = String(payload.userEmail || "").trim();
  if (!email) {
    return NextResponse.json({ ok: true, skipped: "missing-user-email" });
  }
  const title = getTitleFromPayload(payload);

  if (status === "completed") {
    const fileId = fileIdFromBody || String(job.result_file_id || "").trim();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId for completed status." }, { status: 400 });
    }
    await sendGenerationPdfEmail({
      email,
      title,
      downloadUrl: `/api/files/papers/${encodeURIComponent(fileId)}`,
    });
    return NextResponse.json({ ok: true });
  }

  await sendGenerationFailureEmail({
    email,
    title,
    reason: String(job.error_message || "Generation failed."),
  });
  return NextResponse.json({ ok: true });
}

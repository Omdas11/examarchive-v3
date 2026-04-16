import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDatabases, COLLECTION, DATABASE_ID } from "@/lib/appwrite";
import { sendGenerationFailureEmail, sendGenerationPdfEmail } from "@/lib/generation-notifications";
import { buildSignedPdfDownloadPath } from "@/lib/pdf-download-link";

type NotifyPayload = {
  jobId?: unknown;
  status?: unknown;
  fileId?: unknown;
  userId?: unknown;
  userEmail?: unknown;
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

async function resolveNotificationEmail(args: {
  db: ReturnType<typeof adminDatabases>;
  job: Record<string, unknown>;
  payload: Record<string, unknown>;
  payloadUserId: string;
  payloadUserEmail: string;
  jobId: string;
}): Promise<string> {
  const normalizedPayloadUserEmail = String(args.payloadUserEmail || "").trim();
  if (normalizedPayloadUserEmail) return normalizedPayloadUserEmail;
  const payloadEmail = String(args.payload.userEmail || "").trim();
  if (payloadEmail) return payloadEmail;
  const userId = String(args.job.user_id || "").trim() || args.payloadUserId;
  if (!userId) return "";
  try {
    const userDoc = await args.db.getDocument(DATABASE_ID, COLLECTION.users, userId);
    return String(userDoc.email || "").trim();
  } catch (error) {
    console.error("[ai/notify-completion] Failed to resolve user email from users collection.", {
      jobId: args.jobId,
      userId,
      error,
    });
    return "";
  }
}

function getAppwriteErrorStatus(error: unknown): number {
  if (!error || typeof error !== "object") return NaN;
  const appwriteError = error as {
    code?: unknown;
    status?: unknown;
    response?: { code?: unknown; status?: unknown };
  };
  return Number(appwriteError.status ?? appwriteError.code ?? appwriteError.response?.status ?? appwriteError.response?.code ?? NaN);
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
  const payloadUserId = String(body.userId || "").trim();
  const payloadUserEmail = String(body.userEmail || "").trim();
  if (!jobId || (status !== "completed" && status !== "failed")) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const db = adminDatabases();
  let job;
  try {
    job = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId);
  } catch (error) {
    const errorStatus = getAppwriteErrorStatus(error);
    if (errorStatus === 404) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    console.error("[ai/notify-completion] Failed to load job for webhook callback.", { jobId, error });
    return NextResponse.json({ error: "Unable to process notification callback." }, { status: 500 });
  }
  const payload = parseInputPayloadJson(job.input_payload_json);
  const email = await resolveNotificationEmail({
    db,
    job,
    payload,
    payloadUserId,
    payloadUserEmail,
    jobId,
  });
  if (!email) {
    console.error("[ai/notify-completion] Unable to resolve recipient email for webhook callback.", {
      jobId,
      payloadUserId,
      jobUserId: String(job.user_id || "").trim(),
      payloadUserEmail: String(payload.userEmail || "").trim(),
    });
    return NextResponse.json(
      { error: "Unable to resolve recipient email right now. Please retry this callback shortly." },
      { status: 500 },
    );
  }
  const title = getTitleFromPayload(payload);

  if (status === "completed") {
    const fileId = fileIdFromBody || String(job.result_file_id || "").trim();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId for completed status." }, { status: 400 });
    }
    const userId = String(job.user_id || "").trim() || payloadUserId;
    try {
      await sendGenerationPdfEmail({
        email,
        title,
        downloadUrl: buildSignedPdfDownloadPath({
          fileId,
          userId,
        }),
      });
    } catch (error) {
      console.error("[ai/notify-completion] Failed to send completion email.", { jobId, fileId, email, error });
      return NextResponse.json({ error: "Failed to send completion email." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await sendGenerationFailureEmail({
      email,
      title,
      reason: String(job.error_message || "Generation failed."),
    });
  } catch (error) {
    console.error("[ai/notify-completion] Failed to send failure email.", { jobId, email, error });
    return NextResponse.json({ error: "Failed to send failure email." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

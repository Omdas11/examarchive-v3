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

type CallbackTrustCheckArgs = {
  status: "completed" | "failed";
  fileIdFromBody: string;
  job: Record<string, unknown>;
};

const UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES = 3;
const UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS = 300;

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
  hasValidBearer: boolean;
  jobId: string;
}): Promise<string> {
  const payloadEmailField = String(args.payload.userEmail || "").trim();
  const bodyEmailParameter = String(args.payloadUserEmail || "").trim();
  if (args.hasValidBearer && bodyEmailParameter) return bodyEmailParameter;
  if (
    !args.hasValidBearer &&
    bodyEmailParameter &&
    payloadEmailField &&
    bodyEmailParameter.toLowerCase() === payloadEmailField.toLowerCase()
  ) {
    return bodyEmailParameter;
  }
  if (payloadEmailField) return payloadEmailField;

  const jobUserId = String(args.job.user_id || "").trim();
  const payloadUserIdField = String(args.payload.userId || "").trim();
  const bodyUserIdParameter = String(args.payloadUserId || "").trim();
  let fallbackUserIdFromPayload = "";
  if (args.hasValidBearer) {
    fallbackUserIdFromPayload = bodyUserIdParameter;
  } else if (
    bodyUserIdParameter &&
    payloadUserIdField &&
    bodyUserIdParameter === payloadUserIdField
  ) {
    fallbackUserIdFromPayload = bodyUserIdParameter;
  } else {
    fallbackUserIdFromPayload = payloadUserIdField;
  }
  const userId = jobUserId || fallbackUserIdFromPayload;
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

function isUnverifiedCallbackConsistentWithJob(args: CallbackTrustCheckArgs): boolean {
  const jobStatus = String(args.job.status || "").trim().toLowerCase();
  if (jobStatus !== args.status) return false;
  if (args.status === "completed") {
    const storedFileId = String(args.job.result_file_id || "").trim();
    return !!args.fileIdFromBody && !!storedFileId && args.fileIdFromBody === storedFileId;
  }
  const completedAt = String(args.job.completed_at || "").trim();
  return !!completedAt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const webhookSecret = (process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 503 });
  }
  const providedToken = getAuthToken(request);
  const hasValidBearer = !!providedToken && safeCompareSecrets(webhookSecret, providedToken);
  if (providedToken && !hasValidBearer) {
    console.error("[ai/notify-completion] CRITICAL: Webhook authorization token mismatch.", {
      hasProvidedToken: true,
      expectedSecretConfigured: true,
    });
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
      if (!hasValidBearer) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    console.error("[ai/notify-completion] Failed to load job for webhook callback.", { jobId, error });
    return NextResponse.json({ error: "Unable to process notification callback." }, { status: 500 });
  }
  if (!job || typeof job !== "object") {
    return NextResponse.json({ error: "Unable to process notification callback." }, { status: 500 });
  }
  let resolvedJob = job as Record<string, unknown>;
  if (!hasValidBearer) {
    let callbackConsistent = isUnverifiedCallbackConsistentWithJob({
      status: status as "completed" | "failed",
      fileIdFromBody,
      job: resolvedJob,
    });
    for (let retryAttempt = 0; retryAttempt < UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES; retryAttempt += 1) {
      if (callbackConsistent) break;
      await sleep(UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS);
      try {
        const refreshedJob = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId);
        if (refreshedJob && typeof refreshedJob === "object") {
          resolvedJob = refreshedJob as Record<string, unknown>;
          callbackConsistent = isUnverifiedCallbackConsistentWithJob({
            status: status as "completed" | "failed",
            fileIdFromBody,
            job: resolvedJob,
          });
        }
      } catch (retryError) {
        console.error("[ai/notify-completion] Failed to refresh job while validating unverified callback consistency.", {
          jobId,
          status,
          retryAttempt,
          retryError,
        });
      }
    }
    if (!callbackConsistent) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    console.warn("[ai/notify-completion] Processing unverified callback using strict job-state consistency fallback.", {
      jobId,
      status,
      hasProvidedToken: !!providedToken,
    });
  }
  const payload = parseInputPayloadJson(resolvedJob.input_payload_json);

  const email = await resolveNotificationEmail({
    db,
    job: resolvedJob,
    payload,
    payloadUserId,
    payloadUserEmail,
    hasValidBearer,
    jobId,
  });
  if (!email) {
    console.error("[ai/notify-completion] Unable to resolve recipient email for webhook callback.", {
      jobId,
      payloadUserId,
      jobUserId: String(resolvedJob.user_id || "").trim(),
      payloadUserEmail: String(payload.userEmail || "").trim(),
    });
    return NextResponse.json(
      { error: "Unable to resolve recipient email right now. Please retry this callback shortly." },
      { status: 500 },
    );
  }
  const title = getTitleFromPayload(payload);

  if (status === "completed") {
    const fileId = fileIdFromBody || String(resolvedJob.result_file_id || "").trim();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId for completed status." }, { status: 400 });
    }
    const userId = String(resolvedJob.user_id || "").trim() || payloadUserId;
    if (!userId) {
      console.error("[ai/notify-completion] Cannot send completion email: userId is empty, resulting in unsigned download link.", {
        jobId,
        fileId,
        email,
      });
      return NextResponse.json(
        { error: "Cannot send completion notification: user ID is missing for signed download link generation." },
        { status: 400 },
      );
    }
    const existingEmailSentAt = String(resolvedJob.email_sent_at || "").trim();
    if (existingEmailSentAt) {
      console.info("[ai/notify-completion] Email already sent for this job. Skipping duplicate notification.", {
        jobId,
        emailSentAt: existingEmailSentAt,
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "email_already_sent" });
    }
    try {
      await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, {
        email_sent_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[ai/notify-completion] Failed to set email sentinel for job.", {
        jobId,
        error,
      });
      return NextResponse.json({ error: "Unable to record notification state." }, { status: 500 });
    }
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

  const existingEmailStatus = String(resolvedJob.email_status || "").trim();
  if (existingEmailStatus === "failure_sent") {
    console.info("[ai/notify-completion] Failure email already sent for this job. Skipping duplicate notification.", {
      jobId,
      emailStatus: existingEmailStatus,
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "email_already_sent" });
  }
  try {
    await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, {
      email_status: "failure_sent",
    });
  } catch (error) {
    console.error("[ai/notify-completion] Failed to set failure email sentinel for job.", {
      jobId,
      error,
    });
    return NextResponse.json({ error: "Unable to record notification state." }, { status: 500 });
  }
  try {
    await sendGenerationFailureEmail({
      email,
      title,
      reason: String(resolvedJob.error_message || "Generation failed."),
    });
  } catch (error) {
    console.error("[ai/notify-completion] Failed to send failure email.", { jobId, email, error });
    return NextResponse.json({ error: "Failed to send failure email." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

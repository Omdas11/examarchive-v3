import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
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

// FIX: Increased retry budget from 3×300ms (900ms total) to 10×500ms (5 000ms total).
// The Appwrite PDF generator function fires the webhook callback immediately after
// finishing, but the job document write (status="completed", result_file_id) may not
// have propagated to Appwrite DB yet when the first callback arrives.  The old 900ms
// window was too short for this eventual-consistency gap, causing the trust-check to
// reject the callback with 401 on the first click.
const UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES = 10;
const UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS = 500;

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

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
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
  const payloadEmailField = normalizeEmail(args.payload.userEmail);
  const bodyEmailParameter = normalizeEmail(args.payloadUserEmail);
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
  const payloadUserIdFromInput = String(args.payload.userId || "").trim();
  const bodyUserIdFromRequest = String(args.payloadUserId || "").trim();
  let fallbackUserIdFromPayload = "";
  if (args.hasValidBearer) {
    fallbackUserIdFromPayload = bodyUserIdFromRequest;
  } else if (
    bodyUserIdFromRequest &&
    payloadUserIdFromInput &&
    bodyUserIdFromRequest === payloadUserIdFromInput
  ) {
    fallbackUserIdFromPayload = bodyUserIdFromRequest;
  } else {
    fallbackUserIdFromPayload = payloadUserIdFromInput;
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

async function resolveNotificationUserId(args: {
  db: ReturnType<typeof adminDatabases>;
  job: Record<string, unknown>;
  payload: Record<string, unknown>;
  payloadUserId: string;
  hasValidBearer: boolean;
  email: string;
  jobId: string;
}): Promise<string> {
  const jobUserId = String(args.job.user_id || "").trim();
  if (jobUserId) return jobUserId;

  const payloadUserIdFromInput = String(args.payload.userId || "").trim();
  const bodyUserIdFromRequest = String(args.payloadUserId || "").trim();
  if (args.hasValidBearer && bodyUserIdFromRequest) return bodyUserIdFromRequest;
  if (
    !args.hasValidBearer &&
    bodyUserIdFromRequest &&
    payloadUserIdFromInput &&
    bodyUserIdFromRequest === payloadUserIdFromInput
  ) {
    return bodyUserIdFromRequest;
  }
  if (payloadUserIdFromInput) return payloadUserIdFromInput;

  if (!args.hasValidBearer) return "";

  const emailRaw = String(args.email || "").trim();
  if (!emailRaw) return "";
  const candidateEmails = [emailRaw];
  const lowercasedEmail = emailRaw.toLowerCase();
  if (lowercasedEmail !== emailRaw) {
    candidateEmails.push(lowercasedEmail);
  }
  try {
    for (const candidateEmail of candidateEmails) {
      const users = await args.db.listDocuments(DATABASE_ID, COLLECTION.users, [
        Query.equal("email", candidateEmail),
        Query.limit(1),
      ]);
      const resolvedUserIdFromEmail = String(users.documents?.[0]?.$id || "").trim();
      if (resolvedUserIdFromEmail) return resolvedUserIdFromEmail;
    }
    return "";
  } catch (error) {
    console.error("[ai/notify-completion] Failed to resolve user ID from users collection by email.", {
      jobId: args.jobId,
      email: emailRaw,
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

// FIX: Relaxed the "completed" consistency check so that a callback is accepted
// when the job document already has result_file_id stored, even if the callback
// body did not include fileId.  The Appwrite function sometimes fires the webhook
// before embedding the fileId in the request body, causing a false-negative here.
function isUnverifiedCallbackConsistentWithJob(args: CallbackTrustCheckArgs): boolean {
  const jobStatus = String(args.job.status || "").trim().toLowerCase();
  if (jobStatus !== args.status) return false;
  if (args.status === "completed") {
    const storedFileId = String(args.job.result_file_id || "").trim();
    // Accept if either: (a) callback body matches stored fileId, or
    // (b) job doc already has a result_file_id (body fileId may be absent on fast callbacks).
    if (storedFileId && args.fileIdFromBody && args.fileIdFromBody === storedFileId) return true;
    if (storedFileId) return true; // job doc confirms completion even without body fileId
    return false;
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
    console.error("[ai/notify-completion] CRITICAL: Webhook authentication failed.");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    // FIX: Poll with increased budget (10×500ms = 5s) to survive the Appwrite
    // DB eventual-consistency window between function completion and job-doc update.
    let callbackConsistent = isUnverifiedCallbackConsistentWithJob({
      status: status as "completed" | "failed",
      fileIdFromBody,
      job: resolvedJob,
    });

    for (let retryAttempt = 0; retryAttempt < UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES; retryAttempt += 1) {
      if (callbackConsistent) break;
      // Log each retry so Vercel logs expose the race condition clearly.
      console.info("[ai/notify-completion] Unverified callback not yet consistent with job doc; retrying.", {
        jobId,
        status,
        retryAttempt,
        jobStatus: String(resolvedJob.status || ""),
        jobResultFileId: String(resolvedJob.result_file_id || ""),
        fileIdFromBody,
        delayMs: UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS,
      });
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

    // FIX: Final fallback — if we exhausted all retries but the job document now
    // has result_file_id (i.e. the Appwrite write propagated but status field lagged),
    // treat the callback as consistent so the PDF email is not dropped silently.
    if (!callbackConsistent && status === "completed") {
      const storedFileId = String(resolvedJob.result_file_id || "").trim();
      if (storedFileId) {
        console.warn(
          "[ai/notify-completion] Retry budget exhausted but job doc has result_file_id; accepting callback via file-id fallback.",
          {
            jobId,
            storedFileId,
            jobStatus: String(resolvedJob.status || ""),
            totalWaitedMs:
              UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES * UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS,
          },
        );
        callbackConsistent = true;
      }
    }

    if (!callbackConsistent) {
      console.error(
        "[ai/notify-completion] Unverified callback rejected after full retry budget — job doc did not reach expected state.",
        {
          jobId,
          status,
          fileIdFromBody,
          jobStatus: String(resolvedJob.status || ""),
          jobResultFileId: String(resolvedJob.result_file_id || ""),
          retriesExhausted: UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES,
          totalWaitedMs:
            UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES * UNVERIFIED_CALLBACK_JOB_CONSISTENCY_DELAY_MS,
        },
      );
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
    // Prefer fileId from callback body; fall back to what the job doc already has.
    const fileId = fileIdFromBody || String(resolvedJob.result_file_id || "").trim();
    if (!fileId) {
      return NextResponse.json({ error: "Missing fileId for completed status." }, { status: 400 });
    }
    const userId = await resolveNotificationUserId({
      db,
      job: resolvedJob,
      payload,
      payloadUserId,
      hasValidBearer,
      email,
      jobId,
    });
    if (!userId) {
      console.warn("[ai/notify-completion] Sending completion email without signed-user download token because userId could not be resolved.", {
        jobId,
        fileId,
        email,
        hasValidBearer,
      });
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
    try {
      await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, {
        email_sent_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[ai/notify-completion] Completion email sent, but failed to persist email sentinel.", {
        jobId,
        error,
      });
      return NextResponse.json({ ok: true, warning: "email_state_not_persisted" });
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
    await sendGenerationFailureEmail({
      email,
      title,
      reason: String(resolvedJob.error_message || "Generation failed."),
    });
  } catch (error) {
    console.error("[ai/notify-completion] Failed to send failure email.", { jobId, email, error });
    return NextResponse.json({ error: "Failed to send failure email." }, { status: 500 });
  }
  try {
    await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, {
      email_status: "failure_sent",
    });
  } catch (error) {
    console.error("[ai/notify-completion] Failure email sent, but failed to persist failure email sentinel.", {
      jobId,
      error,
    });
    return NextResponse.json({ ok: true, warning: "email_state_not_persisted" });
  }
  return NextResponse.json({ ok: true });
}

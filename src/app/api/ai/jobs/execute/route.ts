import { NextResponse, type NextRequest } from "next/server";
import { processAiGenerationJob } from "@/lib/ai-generation-worker";

const MAX_JOB_ID_LENGTH = 128;

function getWorkerSecret(): string {
  return (
    process.env.APPWRITE_AI_WORKER_SHARED_SECRET ||
    process.env.APPWRITE_WORKER_SHARED_SECRET ||
    process.env.APPWRITE_API_KEY ||
    ""
  ).trim();
}

function normalizeJobId(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const normalized = raw.trim();
  if (!normalized) return "";
  if (normalized.length > MAX_JOB_ID_LENGTH) return "";
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) return "";
  return normalized;
}

export async function POST(request: NextRequest) {
  const workerSecret = getWorkerSecret();
  const providedSecret = (request.headers.get("x-worker-key") || "").trim();
  if (!workerSecret || !providedSecret || providedSecret !== workerSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const jobId = normalizeJobId(body.jobId);
  if (!jobId) {
    return NextResponse.json({ error: "Invalid jobId." }, { status: 400 });
  }

  try {
    await processAiGenerationJob(jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed to process job.";
    return NextResponse.json({ error: "Failed to process worker job.", detail }, { status: 500 });
  }
}

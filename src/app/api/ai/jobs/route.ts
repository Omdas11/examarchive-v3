import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser, getServerUserFromBearerToken } from "@/lib/auth";
import { getDailyLimit } from "@/lib/ai-limits";
import { checkAndResetQuotas } from "@/lib/user-quotas";
import { NOTES_DAILY_LIMIT } from "@/lib/quota-config";
import {
  adminDatabases,
  adminFunctions,
  COLLECTION,
  DATABASE_ID,
  ID,
  Query,
  getAppwriteFileDownloadUrl,
} from "@/lib/appwrite";
import { AI_NOTE_WORKER_FUNCTION_ID, mapJobDocument } from "@/lib/ai-generation-worker";

const MIN_JOBS_LIMIT = 1;
const MAX_JOBS_LIMIT = 50;
const DEFAULT_JOBS_LIMIT = 20;
const MAX_ERROR_MESSAGE_LENGTH = 2000;
const MIN_SEMESTER = 1;
const MAX_SEMESTER = 8;

type CreateJobBody = {
  university?: string;
  course?: string;
  stream?: string;
  type?: string;
  paperCode?: string;
  unitNumber?: number;
  semester?: number | null;
  idempotencyKey?: string;
};

function isAdminPlus(role: string): boolean {
  return role === "admin" || role === "founder";
}

function normalizeSemester(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_SEMESTER || parsed > MAX_SEMESTER) return null;
  return parsed;
}

function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 128);
}

function buildIdempotencySeed(args: {
  userId: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  unitNumber: number;
  semester: number | null;
  dateKey: string;
}): string {
  const raw = [
    args.userId,
    args.course,
    args.stream,
    args.type,
    args.paperCode,
    String(args.unitNumber),
    String(args.semester ?? ""),
    args.dateKey,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

async function getDailyCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

function mapJobResponse(doc: Record<string, unknown>) {
  const mapped = mapJobDocument(doc);
  return {
    ...mapped,
    resultPdfUrl: mapped.resultNoteId ? getAppwriteFileDownloadUrl(mapped.resultNoteId) : null,
  };
}

async function findByIdempotency(userId: string, idempotencyKey: string) {
  const db = adminDatabases();
  const existing = await db.listDocuments(DATABASE_ID, COLLECTION.ai_generation_jobs, [
    Query.equal("user_id", userId),
    Query.equal("idempotency_key", idempotencyKey),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  return existing.documents[0] ?? null;
}

function extractBearerToken(request: NextRequest): string {
  const authHeader = (request.headers.get("authorization") || "").trim();
  if (!authHeader) return "";
  const match = /^bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return "";
  return match[1].trim();
}

async function resolveRequestUser(request: NextRequest) {
  const cookieUser = await getServerUser();
  if (cookieUser) return cookieUser;
  const bearerToken = extractBearerToken(request);
  if (!bearerToken) return null;
  return getServerUserFromBearerToken(bearerToken);
}

export async function POST(request: NextRequest) {
  const user = await resolveRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let body: CreateJobBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const university = (body.university || "Assam University").trim();
  const course = (body.course || "").trim();
  const stream = (body.stream || "").trim();
  const type = (body.type || "").trim();
  const paperCode = (body.paperCode || "").trim();
  const unitNumber = Number(body.unitNumber);
  const semester = normalizeSemester(body.semester);
  if (!course) return NextResponse.json({ error: "Invalid selection: course is required." }, { status: 400 });
  if (!stream) return NextResponse.json({ error: "Invalid selection: stream is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Invalid selection: type is required." }, { status: 400 });
  if (!paperCode) return NextResponse.json({ error: "Invalid selection: paper code is required." }, { status: 400 });
  if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
    return NextResponse.json({ error: "Invalid selection: unit number must be between 1 and 5." }, { status: 400 });
  }
  if (!(process.env.AZURE_GOTENBERG_URL || "").trim()) {
    return NextResponse.json(
      {
        error: "PDF Engine not configured (Missing GOTENBERG_URL). Expected env: AZURE_GOTENBERG_URL.",
        code: "SERVER_MISCONFIGURATION",
      },
      { status: 503 },
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (!isAdminPlus(user.role)) {
    const quota = await checkAndResetQuotas(user.id);
    if (quota.notes_generated_today >= NOTES_DAILY_LIMIT) {
      return NextResponse.json(
        { error: `Daily limit reached for Unit Notes (${NOTES_DAILY_LIMIT}/day).`, code: "NOTES_DAILY_LIMIT_REACHED" },
        { status: 403 },
      );
    }
    const dailyLimit = getDailyLimit();
    const usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
  }

  const providedIdempotency = normalizeIdempotencyKey(body.idempotencyKey);
  const idempotencyKey = providedIdempotency || buildIdempotencySeed({
    userId: user.id,
    course,
    stream,
    type,
    paperCode,
    unitNumber,
    semester,
    dateKey: todayStr,
  });

  const alreadyQueued = await findByIdempotency(user.id, idempotencyKey);
  if (alreadyQueued) {
    return NextResponse.json({
      ok: true,
      reused: true,
      jobId: alreadyQueued.$id,
      job: mapJobResponse(alreadyQueued),
    });
  }

  const db = adminDatabases();
  const createdAtIso = new Date().toISOString();
  const inputPayloadJson = JSON.stringify({
    university,
    course,
    stream,
    type,
    paperCode,
    unitNumber,
    semester,
    userEmail: user.email || "",
    userName: user.name || user.username || "",
  });

  const jobDoc = await db.createDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, ID.unique(), {
    user_id: user.id,
    paper_code: paperCode,
    unit_number: unitNumber,
    status: "queued",
    progress_percent: 0,
    input_payload_json: inputPayloadJson,
    idempotency_key: idempotencyKey,
    created_at: createdAtIso,
  });

  try {
    const functions = adminFunctions();
    await functions.createExecution(
      AI_NOTE_WORKER_FUNCTION_ID,
      JSON.stringify({ jobId: jobDoc.$id }),
      true,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to trigger worker.";
    await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobDoc.$id, {
      status: "failed",
      progress_percent: 100,
      error_message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: "Failed to start job worker.", detail: message }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    reused: false,
    jobId: jobDoc.$id,
    job: mapJobResponse(jobDoc),
  });
}

export async function GET(request: NextRequest) {
  const user = await resolveRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(MIN_JOBS_LIMIT, Math.floor(requestedLimit)), MAX_JOBS_LIMIT)
    : DEFAULT_JOBS_LIMIT;

  const db = adminDatabases();
  const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_generation_jobs, [
    Query.equal("user_id", user.id),
    Query.orderDesc("$createdAt"),
    Query.limit(limit),
  ]);

  return NextResponse.json({
    jobs: res.documents.map((doc) => mapJobResponse(doc)),
  });
}

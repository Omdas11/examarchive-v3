import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { getLimitConfig, setLimits } from "@/lib/ai-limits";

export async function GET() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDatabases();
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);

  let rpm = 0;
  let rpd = 0;

  try {
    const perMinute = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.greaterThan("$createdAt", minuteAgo),
    ]);
    rpm = perMinute.total;
  } catch {
    rpm = 0;
  }

  try {
    const perDay = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.equal("date", todayStr),
    ]);
    rpd = perDay.total;
  } catch {
    rpd = 0;
  }

  return NextResponse.json({
    rpm,
    rpd,
    limits: getLimitConfig(),
  });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { dailyLimit?: number; rpmLimit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  setLimits({
    dailyLimit: typeof body.dailyLimit === "number" ? body.dailyLimit : undefined,
    rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : undefined,
  });

  return NextResponse.json({ limits: getLimitConfig() });
}

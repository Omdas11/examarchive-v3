import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { isFounder } from "@/lib/roles";
import {
  DEFAULT_TOKEN_DAILY_CAP,
  DEFAULT_TOKEN_TTL_DAYS,
  generateUploadCode,
  hashUploadCode,
} from "@/lib/md-verification";

export const dynamic = "force-dynamic";

/**
 * Upload access codes — founder only.
 *
 * GET /api/md-verification/tokens — list codes (hashes are never
 * returned; only metadata + revoked state).
 * POST /api/md-verification/tokens — create a code. Body:
 *   { label?, expires_in_days?, daily_cap? }
 * Returns the raw code ONCE — it cannot be retrieved again afterwards.
 * The raw code is never stored; only its SHA-256 hash goes to D1.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getD1();
    const { results } = await db
      .prepare(
        "SELECT id, label, created_by, expires_at, daily_cap, revoked_at, created_at FROM md_upload_tokens ORDER BY created_at DESC LIMIT 50",
      )
      .all<{
        id: string;
        label: string;
        created_by: string;
        expires_at: number;
        daily_cap: number;
        revoked_at: number | null;
        created_at: number;
      }>();
    return NextResponse.json({ tokens: results ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Could not list upload codes" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    label?: unknown;
    expires_in_days?: unknown;
    daily_cap?: unknown;
  };
  try {
    body = (await request.json()) as {
      label?: unknown;
      expires_in_days?: unknown;
      daily_cap?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 80)
      : "Friend AI upload";
  const ttlDays =
    typeof body.expires_in_days === "number" &&
    Number.isFinite(body.expires_in_days) &&
    body.expires_in_days >= 1 &&
    body.expires_in_days <= 90
      ? Math.floor(body.expires_in_days)
      : DEFAULT_TOKEN_TTL_DAYS;
  const dailyCap =
    typeof body.daily_cap === "number" &&
    Number.isFinite(body.daily_cap) &&
    body.daily_cap >= 1 &&
    body.daily_cap <= 200
      ? Math.floor(body.daily_cap)
      : DEFAULT_TOKEN_DAILY_CAP;

  const code = generateUploadCode();
  const tokenHash = await hashUploadCode(code);
  const now = Date.now();
  const id = crypto.randomUUID();
  try {
    const db = await getD1();
    await db
      .prepare(
        "INSERT INTO md_upload_tokens (id, token_hash, label, created_by, expires_at, daily_cap, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, tokenHash, label, user.id, now + ttlDays * 86400_000, dailyCap, now)
      .run();
  } catch {
    return NextResponse.json(
      { error: "Could not create the upload code" },
      { status: 500 },
    );
  }
  // The raw code is returned exactly once. Store it somewhere safe and
  // share it with the friend's IDE only — it cannot be shown again.
  return NextResponse.json(
    {
      id,
      code,
      label,
      expires_at: now + ttlDays * 86400_000,
      daily_cap: dailyCap,
    },
    { status: 201 },
  );
}

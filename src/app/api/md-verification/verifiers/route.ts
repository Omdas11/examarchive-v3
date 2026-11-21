import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { isFounder } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Assigned verifiers — founder only.
 *
 * GET /api/md-verification/verifiers — list assigned verifiers with
 * their name/email (joined from users).
 * POST /api/md-verification/verifiers — { user_id | email, action:
 * "assign" | "unassign" }. Assigning gives the user access to the
 * verification page and APIs without any role change; the friend stays
 * a student. Unassigning removes that access immediately.
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
        "SELECT v.user_id, v.assigned_by, v.created_at, u.name, u.email FROM md_verifiers v LEFT JOIN users u ON u.id = v.user_id ORDER BY v.created_at DESC LIMIT 50",
      )
      .all<{
        user_id: string;
        assigned_by: string;
        created_at: number;
        name: string | null;
        email: string | null;
      }>();
    return NextResponse.json({ verifiers: results ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Could not list verifiers" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { user_id?: unknown; email?: unknown; action?: unknown };
  try {
    body = (await request.json()) as {
      user_id?: unknown;
      email?: unknown;
      action?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "assign" && body.action !== "unassign") {
    return NextResponse.json(
      { error: "Invalid action: expected assign or unassign" },
      { status: 400 },
    );
  }
  try {
    const db = await getD1();
    let targetId: string | null = null;
    if (typeof body.user_id === "string" && body.user_id.trim()) {
      targetId = body.user_id.trim();
    } else if (typeof body.email === "string" && body.email.trim()) {
      const row = await db
        .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
        .bind(body.email.trim().toLowerCase())
        .first<{ id: string }>();
      targetId = row?.id ?? null;
    }
    if (!targetId) {
      return NextResponse.json(
        { error: "User not found: give a user id or a registered email" },
        { status: 404 },
      );
    }
    if (body.action === "assign") {
      const exists = await db
        .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
        .bind(targetId)
        .first<{ id: string }>();
      if (!exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      await db
        .prepare(
          "INSERT OR IGNORE INTO md_verifiers (user_id, assigned_by, created_at) VALUES (?, ?, ?)",
        )
        .bind(targetId, user.id, Date.now())
        .run();
      return NextResponse.json({ assigned: true, user_id: targetId });
    }
    await db
      .prepare("DELETE FROM md_verifiers WHERE user_id = ?")
      .bind(targetId)
      .run();
    return NextResponse.json({ assigned: false, user_id: targetId });
  } catch {
    return NextResponse.json(
      { error: "Could not update the verifier" },
      { status: 500 },
    );
  }
}

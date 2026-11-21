import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  canAccessMdVerification,
  getItemLock,
  isLockExpired,
} from "@/lib/md-verification-access";

export const dynamic = "force-dynamic";

/**
 * Soft lock for the detail page — advisory only, it never blocks a
 * save (the PUT version check does that). GET returns the current
 * lock; POST claims or refreshes it for the caller. A lock expires 2
 * minutes after its last heartbeat. When the locks table does not
 * exist yet (migration 0013 not applied) both endpoints answer
 * { locksUnavailable: true } and the page carries on without locks.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json({ lock: await getItemLock(id, user.id) });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const db = await getD1();
    const now = Date.now();
    const row = await db
      .prepare(
        "SELECT locked_by, locked_by_label, locked_at FROM md_verification_locks WHERE item_id = ? LIMIT 1",
      )
      .bind(id)
      .first<{
        locked_by: string;
        locked_by_label: string | null;
        locked_at: number;
      }>();
    const label = user.name || user.email || user.id;
    if (!row || isLockExpired(row.locked_at) || row.locked_by === user.id) {
      await db
        .prepare(
          "INSERT INTO md_verification_locks (item_id, locked_by, locked_by_label, locked_at) VALUES (?, ?, ?, ?) " +
            "ON CONFLICT(item_id) DO UPDATE SET locked_by = excluded.locked_by, locked_by_label = excluded.locked_by_label, locked_at = excluded.locked_at",
        )
        .bind(id, user.id, label, now)
        .run();
      return NextResponse.json({
        lock: {
          item_id: id,
          locked_by: user.id,
          locked_by_label: label,
          locked_at: now,
          mine: true,
        },
      });
    }
    return NextResponse.json({
      lock: {
        item_id: id,
        locked_by: row.locked_by,
        locked_by_label: row.locked_by_label,
        locked_at: row.locked_at,
        mine: false,
      },
    });
  } catch {
    return NextResponse.json({ lock: null, locksUnavailable: true });
  }
}

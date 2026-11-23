import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";

/**
 * POST /api/profile/whatsapp-joined
 * Record that the authenticated user clicked Join on the WhatsApp channel
 * popup, so it stops showing for them. Guests have no account and use
 * localStorage instead, so this route is registered-users only.
 */
export async function POST() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getD1();
    await db
      .prepare("UPDATE users SET whatsapp_channel_joined = 1 WHERE id = ?")
      .bind(user.id)
      .run();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      "[api/profile/whatsapp-joined] Failed to save:",
      errorMessage,
      err,
    );
    return NextResponse.json(
      { error: "Failed to save", details: errorMessage },
      { status: 500 },
    );
  }
}

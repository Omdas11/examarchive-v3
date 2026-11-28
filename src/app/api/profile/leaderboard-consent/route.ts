import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";

/**
 * POST /api/profile/leaderboard-consent
 *
 * Records the signed-in user's leaderboard name choice: show their real
 * name on the public XP board, or username only. Body: { showName: boolean }
 * (true = 1, false = 0). The cached board (leaderboard-v1) is cleared so
 * the change shows immediately instead of at the next hourly refresh.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const showName = (body as { showName?: unknown } | null)?.showName;
  if (typeof showName !== "boolean") {
    return NextResponse.json(
      { error: "showName must be a boolean" },
      { status: 400 },
    );
  }

  const db = await getD1();
  await db
    .prepare("UPDATE users SET leaderboard_name_visible = ? WHERE id = ?")
    .bind(showName ? 1 : 0, user.id)
    .run();

  // Clear the cached board so the new choice applies right away. Best
  // effort: if KV is unavailable the 1h TTL expires on its own.
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) await kv.delete("leaderboard-v1");
  } catch {
    // ignore — cache expires within the hour
  }

  return NextResponse.json({
    ok: true,
    leaderboard_name_visible: showName ? 1 : 0,
  });
}

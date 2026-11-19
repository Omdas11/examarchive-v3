import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";
import {
  DOMAIN_COST_PAISE,
  SUPPORT_STATS_KV_KEY,
  SUPPORT_STATS_KV_TTL_SECONDS,
} from "@/lib/support";

/**
 * GET /api/support/stats — public support-pool totals.
 * { raisedPaise, goalPaise, donors, percent }
 * KV-cached 5 min (shared across isolates); falls back to plain D1.
 */
export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(SUPPORT_STATS_KV_KEY, "json");
      if (cached) return NextResponse.json(cached);
    }
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(amount_paise), 0) AS raised, COUNT(*) AS donors FROM donations WHERE status = 'paid'",
      )
      .first<{ raised: number; donors: number }>();
    const raisedPaise = Number(row?.raised ?? 0);
    const donors = Number(row?.donors ?? 0);
    const stats = {
      raisedPaise,
      goalPaise: DOMAIN_COST_PAISE,
      donors,
      percent: Math.min(100, Math.round((raisedPaise / DOMAIN_COST_PAISE) * 100)),
    };
    if (kv) {
      await kv.put(SUPPORT_STATS_KV_KEY, JSON.stringify(stats), {
        expirationTtl: SUPPORT_STATS_KV_TTL_SECONDS,
      });
    }
    return NextResponse.json(stats);
  } catch {
    return NextResponse.json({
      raisedPaise: 0,
      goalPaise: DOMAIN_COST_PAISE,
      donors: 0,
      percent: 0,
    });
  }
}

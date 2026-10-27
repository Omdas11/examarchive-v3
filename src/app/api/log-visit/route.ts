import { NextResponse, type NextRequest } from "next/server";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  ID,
} from "@/lib/appwrite";
import { getUser } from "@/lib/auth";

/**
 * POST /api/log-visit — record one page view in the visit_logs collection.
 *
 * Called fire-and-forget by the VisitLogger beacon (navigator.sendBeacon)
 * on every client-side navigation. The visitor IP comes from Vercel's
 * forwarding headers; city/country come from Vercel's free geolocation
 * headers — no third-party lookup service involved.
 *
 * This route NEVER fails the page: any error (missing collection, DB
 * hiccup, bad payload) is swallowed server-side and still returns 200,
 * because the beacon must never break navigation.
 *
 * Privacy: rows are readable only via the server API key / admin console.
 * No page reads this collection client-side.
 */

function firstIp(header: string | null): string {
  if (!header) return "";
  // x-forwarded-for is "client, proxy1, proxy2" — the client IP is first.
  return header.split(",")[0].trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export async function POST(request: NextRequest) {
  try {
    let path = "";
    try {
      const body = (await request.json()) as { path?: unknown };
      if (typeof body.path === "string") path = body.path;
    } catch {
      // Empty / non-JSON beacon body: still log with an empty path.
    }
    if (!path) return NextResponse.json({ ok: true });

    const headers = request.headers;
    const ip =
      firstIp(headers.get("x-forwarded-for")) ||
      headers.get("x-real-ip") ||
      "";
    const userAgent = headers.get("user-agent") || "";
    const referrer = headers.get("referer") || "";
    const country = headers.get("x-vercel-ip-country") || "";
    const city = headers.get("x-vercel-ip-city") || "";

    // Logged-in identity WITHOUT getServerUser's side effects (it updates
    // streaks and evaluates promotions — wrong for a per-page-view log).
    // getUser() only validates the session cookie; one extra profile read
    // resolves the role for founder/moderator flagging.
    let userId: string | null = null;
    let userRole: string | null = null;
    try {
      const sessionUser = await getUser();
      if (sessionUser) {
        userId = sessionUser.$id;
        try {
          const db = adminDatabases();
          const profile = await db.getDocument(
            DATABASE_ID,
            COLLECTION.users,
            userId,
          );
          const rec = profile as unknown as Record<string, unknown>;
          if (typeof rec.role === "string") userRole = rec.role;
        } catch {
          // Profile doc missing (legacy account): keep user_id, no role.
        }
      }
    } catch {
      // Session invalid: treat as anonymous.
    }

    const db = adminDatabases();
    await db.createDocument(DATABASE_ID, COLLECTION.visit_logs, ID.unique(), {
      ip: truncate(ip, 64),
      path: truncate(path, 500),
      user_agent: truncate(userAgent, 500),
      referrer: truncate(referrer, 500),
      country: truncate(country, 8),
      city: truncate(city, 100),
      user_id: userId ?? "",
      user_role: userRole ?? "",
    });
  } catch (err) {
    // Never break the page over analytics.
    console.error("[log-visit] failed:", err);
  }
  return NextResponse.json({ ok: true });
}

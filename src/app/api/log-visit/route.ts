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
 * on every client-side navigation. The site sits behind Cloudflare, so
 * Vercel only sees Cloudflare edge IPs: x-forwarded-for and Vercel's
 * geo headers describe the edge (e.g. Marseille, Singapore), NOT the
 * visitor. The real visitor IP is in Cloudflare's cf-connecting-ip
 * header and the real country in cf-ipcountry — but only when the
 * connecting IP is actually a Cloudflare edge IP, so a direct hit on
 * the Vercel URL cannot spoof them. When Cloudflare headers are used,
 * the Vercel city is the edge city, so it is dropped rather than
 * recorded as a false visitor location. No third-party lookup service
 * is involved.
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

function lastIp(header: string | null): string {
  if (!header) return "";
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

// Cloudflare's published IPv4 edge ranges (https://www.cloudflare.com/ips/).
const CLOUDFLARE_V4: Array<[string, number]> = [
  ["173.245.48.0", 20],
  ["103.21.244.0", 22],
  ["103.22.200.0", 22],
  ["103.31.4.0", 22],
  ["141.101.64.0", 18],
  ["108.162.192.0", 18],
  ["190.93.240.0", 20],
  ["188.114.96.0", 20],
  ["197.234.240.0", 22],
  ["198.41.128.0", 17],
  ["162.158.0.0", 15],
  ["104.16.0.0", 13],
  ["104.24.0.0", 14],
  ["172.64.0.0", 13],
  ["131.0.72.0", 22],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function inV4Cidr(ip: string, cidr: string, bits: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(cidr);
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// Cloudflare IPv6 edge ranges, checked by first-hextet prefix (the
// /29 range 2a06:98c0:: covers 2a06:98c0-2a06:98c7).
function isCloudflareV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (!lower.includes(":")) return false;
  const head = lower.split(":").slice(0, 2).join(":");
  if (
    ["2400:cb00", "2606:4700", "2803:f800", "2405:b500", "2c0f:feb0"].includes(
      head,
    )
  ) {
    return true;
  }
  const second = lower.split(":")[1] ?? "";
  const secondInt = parseInt(second, 16);
  return lower.startsWith("2a06:") && secondInt >= 0x98c0 && secondInt <= 0x98c7;
}

function isCloudflareIp(ip: string): boolean {
  if (ip.includes(":")) return isCloudflareV6(ip);
  return CLOUDFLARE_V4.some(([cidr, bits]) => inV4Cidr(ip, cidr, bits));
}

function resolveClient(
  headers: Headers,
): { ip: string; country: string; city: string } {
  const forwarded = headers.get("x-forwarded-for");
  // The connecting IP is the last hop in x-forwarded-for, or x-real-ip.
  const connecting = lastIp(forwarded) || headers.get("x-real-ip") || "";
  const viaCloudflare = connecting !== "" && isCloudflareIp(connecting);
  const cfIp = headers.get("cf-connecting-ip")?.trim() || "";
  const trueClientIp = headers.get("true-client-ip")?.trim() || "";
  if (viaCloudflare && cfIp) {
    // Real visitor country from Cloudflare; Vercel city would be the
    // edge city, so leave it blank instead of recording a false city.
    return {
      ip: cfIp,
      country: headers.get("cf-ipcountry")?.trim() || "",
      city: "",
    };
  }
  if (viaCloudflare && trueClientIp) {
    return {
      ip: trueClientIp,
      country: headers.get("cf-ipcountry")?.trim() || "",
      city: "",
    };
  }
  return {
    ip: firstIp(forwarded) || headers.get("x-real-ip") || "",
    country: headers.get("x-vercel-ip-country") || "",
    city: headers.get("x-vercel-ip-city") || "",
  };
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
    const { ip, country, city } = resolveClient(headers);
    const userAgent = headers.get("user-agent") || "";
    const referrer = headers.get("referer") || "";

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

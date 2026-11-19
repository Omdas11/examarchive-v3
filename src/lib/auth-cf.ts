/**
 * Auth for the Cloudflare build (Phase 5): Google sign-in via sessions
 * stored in D1. This replaces the Appwrite session layer (src/lib/auth.ts)
 * on the migrate/cloudflare branch.
 *
 * Design:
 * - Session cookie `ea_cf_session` holds a random 32-byte token. Only the
 *   SHA-256 hash is stored in the `sessions` table (id = hash), never the
 *   raw token. Sessions live 30 days.
 * - No D1 write on every request: expiry is only extended when fewer than
 *   7 days remain (sliding renewal).
 * - `getServerUser()` has the same signature as the Appwrite version and
 *   returns the same `UserProfile` shape, so callers need no changes.
 *   It never throws: any failure (no cookie, bad session, D1 down) is a
 *   guest (null), exactly like the Appwrite version's fail-closed behaviour.
 * - Rate limiting for the auth endpoints lives here too (KV-backed,
 *   fail-open): the Cloudflare WAF /api/* rule (10 req/10s per IP) is the
 *   first line of defence; this adds a per-action 10-attempts/10-minutes
 *   cap on the Google start/callback routes.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "./d1";
import { isValidCustomRole, normalizeRole, xpTier } from "./roles";
import { DEFAULT_CREDITS } from "./economy";
import type { UserProfile, UserRole } from "@/types";

/** Cookie holding the raw session token (hash is stored in D1). */
export const CF_SESSION_COOKIE = "ea_cf_session";

/** Session lifetime: 30 days. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Extend expiry when fewer than 7 days remain (one D1 write, rarely). */
export const SESSION_RENEW_BEFORE_MS = 7 * 24 * 60 * 60 * 1000;

/** Columns selected for the signed-in user. No `SELECT *`. */
const USER_COLUMNS = [
  "id",
  "email",
  "name",
  "display_name",
  "username",
  "avatar_url",
  "google_sub",
  "role",
  "secondary_role",
  "xp",
  "streak_days",
  "last_activity",
  "ai_credits",
  "created_at",
] as const;

type UserRow = Record<string, unknown>;

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Cryptographically random token (32 bytes, base64url). */
export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** SHA-256 hex of a session token — what `sessions.id` stores. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cookie options shared by the session cookie. */
/**
 * Cookie options for the CF session. The cookie is shared across
 * examarchive.dev and www.examarchive.dev (domain .examarchive.dev), so
 * one sign-in works on both hosts — it used to be host-only, so a user
 * signed in on www looked logged out on the apex (and vice versa), which
 * showed a missing login state on direct visits. On localhost and the
 * workers.dev preview the cookie stays host-only (a domain cookie cannot
 * be set from those hosts).
 */
export function sessionCookieOptions(secure: boolean, host?: string) {
  const options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
    domain?: string;
  } = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
  if (host && (host === "examarchive.dev" || host.endsWith(".examarchive.dev"))) {
    options.domain = ".examarchive.dev";
  }
  return options;
}

/** Map a D1 users row to the app's `UserProfile` shape. */
export function userRowToProfile(row: UserRow): UserProfile {
  const name =
    (row.display_name as string) || (row.name as string) || "";
  const createdAt =
    typeof row.created_at === "number"
      ? new Date(row.created_at).toISOString()
      : (row.created_at as string) ?? "";
  const lastActivity =
    typeof row.last_activity === "number"
      ? new Date(row.last_activity).toISOString()
      : (row.last_activity as string) ?? "";
  return {
    id: row.id as string,
    email: (row.email as string) ?? "",
    name,
    username: (row.username as string) ?? "",
    avatar_url: (row.avatar_url as string) ?? "",
    role: normalizeRole((row.role as string) ?? "student"),
    secondary_role: isValidCustomRole(row.secondary_role)
      ? row.secondary_role
      : null,
    // Tier is derived from XP alone, never from the stored value.
    tier: xpTier(Number(row.xp ?? 0)),
    xp: Number(row.xp ?? 0),
    specialist_subject: null,
    subject_admin_subject: null,
    ai_credits: Number(row.ai_credits ?? 0),
    streak_days: Number(row.streak_days ?? 0),
    last_activity: lastActivity,
    created_at: createdAt,
  };
}

/**
 * Create a session row for a user and return the raw token (set it as the
 * cookie). The stored id is the SHA-256 hash of the token.
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  const id = await hashToken(token);
  const now = Date.now();
  const db = await getD1();
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(id, userId, now + SESSION_TTL_MS, now)
    .run();
  return token;
}

/** Delete a session row by raw token (no-op when unknown). */
export async function deleteSessionByToken(token: string): Promise<void> {
  try {
    const id = await hashToken(token);
    const db = await getD1();
    await db
      .prepare("DELETE FROM sessions WHERE id = ?")
      .bind(id)
      .run();
  } catch {
    // Sign-out must never fail the request — the cookie is cleared anyway.
  }
}

interface SessionLookup {
  user: UserRow;
  expiresAt: number;
}

/**
 * Validate a raw session token against D1. Returns the user profile plus
 * the session expiry, or null. Renews the session (one D1 write) only
 * when fewer than 7 days remain.
 */
export async function validateSessionToken(
  token: string,
): Promise<SessionLookup | null> {
  if (!token) return null;
  const id = await hashToken(token);
  const db = await getD1();
  const columns = USER_COLUMNS.map((c) => `u.${c}`).join(", ");
  const row = await db
    .prepare(
      `SELECT ${columns}, s.expires_at AS expires_at FROM sessions s ` +
        `JOIN users u ON u.id = s.user_id WHERE s.id = ? LIMIT 1`,
    )
    .bind(id)
    .first<UserRow & { expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    // Expired: clean up the row, treat as guest.
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }
  if (row.expires_at - Date.now() < SESSION_RENEW_BEFORE_MS) {
    await db
      .prepare("UPDATE sessions SET expires_at = ? WHERE id = ?")
      .bind(Date.now() + SESSION_TTL_MS, id)
      .run();
  }
  return { user: row, expiresAt: row.expires_at };
}

/**
 * The currently signed-in user's profile, or null for guests.
 * Same signature as the Appwrite `getServerUser` in src/lib/auth.ts.
 * Cached per request (React `cache()`), so several callers in one request
 * share a single D1 lookup.
 */
export const getServerUser: () => Promise<UserProfile | null> = cache(
  async function getServerUser(): Promise<UserProfile | null> {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(CF_SESSION_COOKIE)?.value;
      if (!token) return null;
      const session = await validateSessionToken(token);
      if (!session) return null;
      return userRowToProfile(session.user);
    } catch {
      // No cookie / D1 unavailable / any failure → guest. Never throw.
      return null;
    }
  },
);

/** Read the raw session token from the request cookies (or null). */
export async function getSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(CF_SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

// ── Rate limiting (auth endpoints) ────────────────────────────────────────

/**
 * KV-backed per-IP attempt cap. Returns true when the attempt is allowed.
 * Fail-open: any KV error (or missing binding) allows the request — auth
 * must never break because the limiter is down. The WAF /api/* rule
 * (10 req/10s per IP) is the hard limit; this adds a slower cap so a
 * single IP cannot hammer the Google start/callback routes all day.
 */
export async function checkAuthRateLimit(
  ip: string,
  action: string,
  limit = 10,
  windowSeconds = 600,
): Promise<boolean> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (!kv) return true;
    const key = `ratelimit:auth:${action}:${ip}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) || 0 : 0;
    if (count >= limit) return false;
    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return true;
  } catch {
    return true;
  }
}

/** Best-effort client IP from the request headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── User upsert (Google sign-in) ──────────────────────────────────────────

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

/**
 * Find-or-create a user from a verified Google identity.
 * - Match by `google_sub` first (returning users).
 * - Else match by verified `email` (the 3 migrated users have
 *   `google_sub = NULL`) and attach `google_sub`.
 * - Else create a new `student` user (100 starting credits, like the old
 *   Appwrite auto-create).
 * Returns the user id. Name/avatar are refreshed from Google on login.
 */
export async function upsertGoogleUser(
  identity: GoogleIdentity,
): Promise<string> {
  const db = await getD1();
  const now = Date.now();
  const columns = USER_COLUMNS.join(", ");

  const bySub = await db
    .prepare(`SELECT ${columns} FROM users WHERE google_sub = ? LIMIT 1`)
    .bind(identity.sub)
    .first<UserRow>();
  if (bySub) {
    await db
      .prepare(
        "UPDATE users SET name = ?, display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?",
      )
      .bind(identity.name, identity.name, identity.picture, now, bySub.id)
      .run();
    return bySub.id as string;
  }

  const byEmail = await db
    .prepare(`SELECT ${columns} FROM users WHERE email = ? LIMIT 1`)
    .bind(identity.email)
    .first<UserRow>();
  if (byEmail) {
    await db
      .prepare(
        "UPDATE users SET google_sub = ?, name = ?, display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        identity.sub,
        identity.name,
        identity.name,
        identity.picture,
        now,
        byEmail.id,
      )
      .run();
    return byEmail.id as string;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, email, name, display_name, username, avatar_url, google_sub, role, xp, streak_days, ai_credits, created_at, updated_at) ` +
        `VALUES (?, ?, ?, ?, ?, ?, ?, 'student', 0, 0, ?, ?, ?)`,
    )
    .bind(
      id,
      identity.email,
      identity.name,
      identity.name,
      "",
      identity.picture,
      identity.sub,
      DEFAULT_CREDITS,
      now,
      now,
    )
    .run();
  return id;
}

/** Keep the `role` type import used (re-exported for route handlers). */
export type { UserRole };

import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";
import { xpTier, tierLabel } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "XP Leaderboard — ExamArchive",
  description:
    "Top ExamArchive contributors ranked by XP. Earn XP by logging in daily and verifying question papers.",
  alternates: { canonical: "/leaderboard" },
};

interface LeaderboardRow {
  id: string;
  username: string | null;
  name: string | null;
  role: string;
  xp: number;
  created_at: number | string;
}

const KV_KEY = "leaderboard-v1";
const KV_TTL_SECONDS = 3600;
const PAGE_SIZE = 50;

/**
 * Top 50 users by XP, ties broken by earliest join. Cached in KV for 1h
 * (same pattern as /stats): one small SELECT per hour at most, ~43 rows
 * read per cache miss, so the board costs ~0 D1 reads on normal traffic.
 * Names only — never emails — are shown on the public board.
 */
async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as LeaderboardRow[];
    }
    const db = await getD1();
    const { results } = await db
      .prepare(
        "SELECT id, username, name, role, xp, created_at FROM users " +
          "ORDER BY xp DESC, created_at ASC LIMIT ?",
      )
      .bind(PAGE_SIZE)
      .all<LeaderboardRow>();
    const rows = results ?? [];
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(rows), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return rows;
  } catch {
    const db = await getD1();
    const { results } = await db
      .prepare(
        "SELECT id, username, name, role, xp, created_at FROM users " +
          "ORDER BY xp DESC, created_at ASC LIMIT ?",
      )
      .bind(PAGE_SIZE)
      .all<LeaderboardRow>();
    return results ?? [];
  }
}

function displayName(row: LeaderboardRow): string {
  return row.name || row.username || "Anonymous";
}

function rankMedal(rank: number): { bg: string; fg: string } | null {
  if (rank === 1) return { bg: "#fef3c7", fg: "#92400e" };
  if (rank === 2) return { bg: "#f1f5f9", fg: "#475569" };
  if (rank === 3) return { bg: "#ffedd5", fg: "#9a3412" };
  return null;
}

export default async function LeaderboardPage() {
  const [user, rows] = await Promise.all([getServerUser(), fetchLeaderboard()]);
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  // The signed-in user's own rank: in the top 50 already, or one COUNT
  // query for the rank (1 + users ahead of them on xp, ties by join date).
  let myRank: number | null = null;
  if (user) {
    const inTop = rows.findIndex((r) => r.id === user.id);
    if (inTop >= 0) {
      myRank = inTop + 1;
    } else {
      try {
        const db = await getD1();
        const ahead = await db
          .prepare(
            "SELECT COUNT(*) AS n FROM users WHERE xp > ? " +
              "OR (xp = ? AND created_at < ?)",
          )
          .bind(user.xp ?? 0, user.xp ?? 0, user.created_at)
          .first<{ n: number }>();
        myRank = (ahead?.n ?? 0) + 1;
      } catch {
        myRank = null;
      }
    }
  }

  return (
    <MainLayout
      title="Leaderboard"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Leaderboard" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 style={{ margin: "0 0 0.5rem" }}>XP Leaderboard</h1>
        <p className="mt-0 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Top contributors ranked by XP. Log in daily for +10 XP and verify
          question papers for +25 XP per approval. The board refreshes every
          hour.
        </p>

        {user && myRank !== null && (
          <p className="mt-4 text-sm font-semibold" style={{ color: "#047857" }}>
            Your rank: #{myRank} with {user.xp ?? 0} XP ({tierLabel(xpTier(user.xp ?? 0))} tier)
          </p>
        )}
        {!user && (
          <p className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <Link href="/login" style={{ color: "#047857", fontWeight: 700 }}>
              Sign in
            </Link>{" "}
            to see your own rank on the board.
          </p>
        )}

        <div className="card mt-6 overflow-hidden rounded-lg p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
              No ranked users yet. Be the first to earn XP.
            </p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {rows.map((row, i) => {
                const rank = i + 1;
                const medal = rankMedal(rank);
                const tier = xpTier(row.xp ?? 0);
                const isMe = user?.id === row.id;
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                    style={{
                      borderBottom:
                        rank < rows.length
                          ? "1px solid var(--hatch-widget-border, #e5e7eb)"
                          : "none",
                      background: isMe ? "color-mix(in srgb, #059669 8%, transparent)" : undefined,
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={
                        medal
                          ? { background: medal.bg, color: medal.fg }
                          : { color: "var(--color-text-muted)" }
                      }
                    >
                      {rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {displayName(row)}
                      {isMe && (
                        <span className="ml-2 text-xs font-bold" style={{ color: "#047857" }}>
                          You
                        </span>
                      )}
                      {row.role === "founder" && (
                        <span className="ml-2 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                          Founder
                        </span>
                      )}
                    </span>
                    <span
                      className="hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize sm:inline-block"
                      style={{
                        color: "#047857",
                        background: "color-mix(in srgb, #059669 12%, var(--color-surface))",
                      }}
                    >
                      {tierLabel(tier)}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">
                      {row.xp ?? 0} XP
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Showing top {rows.length} of all registered users. Only names and XP
          are shown, never email addresses.
        </p>
      </section>
    </MainLayout>
  );
}

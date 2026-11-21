import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { isModerator } from "@/lib/roles";
import { getD1 } from "@/lib/d1";
import type { AdminUser } from "@/types";
import { toAdminUser } from "@/types";
import UsersTable from "./UsersTable";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "User Management",
  description: "Manage users and roles.",
};

export default async function AdminUsersPage() {
  const user = await getServerUser();

  if (!user || !isModerator(user.role)) {
    redirect("/");
  }

  const db = await getD1();

  let users: AdminUser[] = [];
  try {
    const { results } = await db
      .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 100")
      .all();
    const mapped = (results as Record<string, unknown>[]).map(toAdminUser);
    // Last seen per user: latest of any recorded signal — page visit
    // (visit_logs, user_id set for logged-in visits), paper view/download
    // (user_activity), login (sessions.created_at). Three GROUP BY queries
    // instead of one per user. Admin-only page, loaded rarely; the scan is
    // bounded by the visit_logs table size.
    const lastSeen = new Map<string, number>();
    const mergeMax = (rows: { user_id: string; m: number }[]) => {
      for (const row of rows) {
        if (!row.user_id) continue;
        const prev = lastSeen.get(row.user_id) ?? 0;
        if (row.m > prev) lastSeen.set(row.user_id, row.m);
      }
    };
    try {
      const visits = await db
        .prepare(
          "SELECT user_id, MAX(created_at) AS m FROM visit_logs WHERE user_id != '' GROUP BY user_id",
        )
        .all<{ user_id: string; m: number }>();
      mergeMax(visits.results ?? []);
      const activity = await db
        .prepare(
          "SELECT user_id, MAX(created_at) AS m FROM user_activity GROUP BY user_id",
        )
        .all<{ user_id: string; m: number }>();
      mergeMax(activity.results ?? []);
      const sessions = await db
        .prepare(
          "SELECT user_id, MAX(created_at) AS m FROM sessions GROUP BY user_id",
        )
        .all<{ user_id: string; m: number }>();
      mergeMax(sessions.results ?? []);
    } catch {
      // Last-seen stays empty rather than breaking the page.
    }
    // Course prefs mirrored from each user's browser (user_course_prefs),
    // one query for all users. Absent rows mean the user never set courses
    // (or hasn't visited since the sync landed).
    const coursePrefs = new Map<
      string,
      { dsc: string; dsm1: string; dsm2: string; sec: string; idc: string; aec: string; vac: string }
    >();
    try {
      const prefs = await db
        .prepare("SELECT user_id, dsc, dsm1, dsm2, sec, idc, aec, vac FROM user_course_prefs")
        .all<{
          user_id: string;
          dsc: string;
          dsm1: string;
          dsm2: string;
          sec: string;
          idc: string;
          aec: string;
          vac: string;
        }>();
      for (const row of prefs.results ?? []) {
        if (!row.user_id) continue;
        coursePrefs.set(row.user_id, {
          dsc: row.dsc ?? "",
          dsm1: row.dsm1 ?? "",
          dsm2: row.dsm2 ?? "",
          sec: row.sec ?? "",
          idc: row.idc ?? "",
          aec: row.aec ?? "",
          vac: row.vac ?? "",
        });
      }
    } catch {
      // Course prefs stay empty rather than breaking the page.
    }
    // Verified counts (verify-to-earn ledger), one count query per user.
    users = await Promise.all(
      mapped.map(async (u) => {
        try {
          const row = await db
            .prepare(
              "SELECT COUNT(*) AS n FROM content_verifications WHERE user_id = ?",
            )
            .bind(u.id)
            .first<{ n: number }>();
          return {
            ...u,
            verified_count: Number(row?.n ?? 0),
            last_seen_at: lastSeen.has(u.id)
              ? new Date(lastSeen.get(u.id) as number).toISOString()
              : null,
            course_prefs: coursePrefs.get(u.id) ?? null,
          };
        } catch {
          return {
            ...u,
            verified_count: 0,
            last_seen_at: lastSeen.has(u.id)
              ? new Date(lastSeen.get(u.id) as number).toISOString()
              : null,
            course_prefs: coursePrefs.get(u.id) ?? null,
          };
        }
      }),
    );
  } catch {
    // table may not exist yet
  }
  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="User Management"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Users" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {users.length} user{users.length !== 1 ? "s" : ""} registered
        </p>
      </div>

      <UsersTable
        users={users}
        currentAdminId={user.id}
        currentAdminRole={user.role}
      />
    </section>
    </MainLayout>
  );
}

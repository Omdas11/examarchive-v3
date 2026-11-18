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
          return { ...u, verified_count: Number(row?.n ?? 0) };
        } catch {
          return { ...u, verified_count: 0 };
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

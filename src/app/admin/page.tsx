import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { isAdmin, isModerator } from "@/lib/roles";
import { getD1 } from "@/lib/d1";
import type { Paper, AdminUser, ActivityLogEntry, Syllabus } from "@/types";
import { toPaper, toAdminUser, toActivityLog, toSyllabus } from "@/types";
import AdminDashboard from "@/components/AdminDashboard";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage papers, approve uploads, and administer the archive.",
};

export default async function AdminPage() {
  const user = await getServerUser();

  if (!user || !isModerator(user.role)) {
    redirect("/");
  }

  const db = await getD1();

  let pending: Paper[] = [];
  let approvedCount = 0;

  try {
    const { results } = await db
      .prepare("SELECT * FROM papers WHERE approved = 0 ORDER BY created_at DESC")
      .all();
    pending = (results as Record<string, unknown>[]).map(toPaper);
  } catch {
    // table may not exist yet
  }

  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM papers WHERE approved = 1")
      .first<{ n: number }>();
    approvedCount = Number(row?.n ?? 0);
  } catch {
    // table may not exist yet
  }

  // Fetch pending PDF syllabi for moderation
  let pendingSyllabi: Syllabus[] = [];
  try {
    const { results } = await db
      .prepare(
        "SELECT * FROM syllabus WHERE approval_status = 'pending' ORDER BY created_at DESC",
      )
      .all();
    pendingSyllabi = (results as Record<string, unknown>[]).map(toSyllabus);
  } catch {
    // table may not exist yet
  }

  // Fetch pending Vault (MDX) syllabi from Syllabus_Table
  let pendingVaultCount = 0;
  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM syllabus_table WHERE status = 'pending'")
      .first<{ n: number }>();
    pendingVaultCount = Number(row?.n ?? 0);
  } catch {
    // table may not exist yet
  }

  // Fetch all users (admin only)
  let users: AdminUser[] = [];
  if (isAdmin(user.role)) {
    try {
      const { results } = await db
        .prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 100")
        .all();
      users = (results as Record<string, unknown>[]).map(toAdminUser);
    } catch {
      // table may not exist yet
    }
  }

  // Fetch activity logs
  let activityLogs: ActivityLogEntry[] = [];
  try {
    const { results } = await db
      .prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100")
      .all();
    activityLogs = (results as Record<string, unknown>[]).map(toActivityLog);
  } catch {
    // table may not exist yet
  }

  const stats = [
    { label: "Pending Papers", value: pending?.length ?? 0 },
    { label: "Approved", value: approvedCount ?? 0 },
    { label: "Pending Syllabi (PDF)", value: pendingSyllabi.length },
    { label: "Pending Vault Submissions", value: pendingVaultCount },
    { label: "Users", value: users.length },
  ];
  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Admin Dashboard"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Admin" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Header */}
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      <AdminDashboard
        pending={pending}
        pendingSyllabi={pendingSyllabi}
        users={users}
        activityLogs={activityLogs}
        currentAdminId={user.id}
        currentAdminRole={user.role}
        stats={stats}
      />
    </section>
    </MainLayout>
  );
}

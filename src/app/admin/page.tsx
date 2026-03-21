import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin, isModerator } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
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

  const db = adminDatabases();

  let pending: Paper[] = [];
  let approvedCount = 0;

  try {
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      [Query.equal("approved", false), Query.orderDesc("$createdAt")],
    );
    pending = documents.map(toPaper);
  } catch {
    // collection may not exist yet
  }

  try {
    const approvedResult = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      [Query.equal("approved", true), Query.limit(1)],
    );
    approvedCount = approvedResult.total;
  } catch {
    // collection may not exist yet
  }

  // Fetch pending syllabi for moderation
  let pendingSyllabi: Syllabus[] = [];
  try {
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.syllabus,
      [Query.equal("approval_status", "pending"), Query.orderDesc("$createdAt")],
    );
    pendingSyllabi = documents.map((d) => toSyllabus(d));
  } catch {
    // collection may not exist yet
  }

  // Fetch all users (admin only)
  let users: AdminUser[] = [];
  if (isAdmin(user.role)) {
    try {
      const { documents } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.users,
        [Query.orderDesc("$createdAt"), Query.limit(100)],
      );
      users = documents.map((d) => toAdminUser(d as unknown as Record<string, unknown>));
    } catch {
      // collection may not exist yet
    }
  }

  // Fetch activity logs
  let activityLogs: ActivityLogEntry[] = [];
  try {
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.activity_logs,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );
    activityLogs = documents.map((d) => toActivityLog(d as unknown as Record<string, unknown>));
  } catch {
    // collection may not exist yet
  }

  const stats = [
    { label: "Pending Papers", value: pending?.length ?? 0 },
    { label: "Approved", value: approvedCount ?? 0 },
    { label: "Pending Syllabi", value: pendingSyllabi.length },
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

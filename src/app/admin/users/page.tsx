import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { AdminUser } from "@/types";
import { toAdminUser } from "@/types";
import UsersTable from "./UsersTable";

export const metadata: Metadata = {
  title: "User Management",
  description: "Manage users, roles, and tiers.",
};

export default async function AdminUsersPage() {
  const user = await getServerUser();

  if (!user || !isModerator(user.role)) {
    redirect("/");
  }

  const db = adminDatabases();

  let users: AdminUser[] = [];
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

  return (
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
  );
}

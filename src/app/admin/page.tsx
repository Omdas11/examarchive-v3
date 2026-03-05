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
import type { Paper } from "@/types";
import { toPaper } from "@/types";
import AdminActions from "@/components/AdminActions";

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

  const stats = [
    { label: "Pending", value: pending?.length ?? 0 },
    { label: "Approved", value: approvedCount ?? 0 },
    { label: "Published", value: approvedCount ?? 0 },
    { label: "Rejected", value: 0 },
  ];

  const tabs = ["Pending", "Approved", "All Submissions"];

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Header */}
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <span key={t} className={`toggle-btn ${i === 0 ? "active" : ""}`}>{t}</span>
        ))}
      </div>

      {/* Submissions area */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        <AdminActions papers={pending} />
      </div>
    </section>
  );
}

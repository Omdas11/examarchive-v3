import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabaseServer";
import type { Paper } from "@/types";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage papers, approve uploads, and administer the archive.",
};

export default async function AdminPage() {
  const user = await getServerUser();

  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }

  const supabase = createClient();
  const { data: pending } = await supabase
    .from("papers")
    .select("*")
    .eq("approved", false)
    .order("created_at", { ascending: false });

  const { count: approvedCount } = await supabase
    .from("papers")
    .select("*", { count: "exact", head: true })
    .eq("approved", true);

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
        {pending && pending.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {pending.map((p: Paper) => (
              <li key={p.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {p.course_code} · {p.department} · {p.year}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action="/api/admin" method="POST">
                    <input type="hidden" name="action" value="approve" />
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                  </form>
                  <form action="/api/admin" method="POST">
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 text-center card p-8">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No papers pending approval.</p>
          </div>
        )}
      </div>
    </section>
  );
}

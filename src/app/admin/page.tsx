import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabaseServer";
import UploadForm from "@/components/UploadForm";
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

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Logged in as <strong>{user.email}</strong> ({user.role})
      </p>

      {/* Upload section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Upload Paper</h2>
        <div className="mt-4">
          <UploadForm />
        </div>
      </div>

      {/* Pending approvals */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold">Pending Approvals</h2>
        {pending && pending.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-200 dark:divide-gray-800">
            {pending.map((p: Paper) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.course_code} &middot; {p.department} &middot; {p.year}
                  </p>
                </div>
                <form action="/api/admin" method="POST">
                  <input type="hidden" name="action" value="approve" />
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-400">No papers pending approval.</p>
        )}
      </div>
    </section>
  );
}

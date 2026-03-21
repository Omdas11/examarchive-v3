import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isFounder } from "@/lib/roles";
import DevToolClient from "./DevToolClient";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "DevTool",
  description: "Founder-only developer tools for ExamArchive.",
  robots: { index: false, follow: false },
};

export default async function DevToolPage() {
  const user = await getServerUser();

  if (!user || !isFounder(user.role)) {
    redirect("/");
  }
  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="DevTool"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "DevTool" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <div className="mb-6 flex items-center gap-3">
        <span className="text-3xl">👑</span>
        <div>
          <h1 className="text-2xl font-bold">DevTool</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Founder-only system management tools. Use with caution.
          </p>
        </div>
      </div>

      <div
        className="mb-6 rounded-lg px-4 py-3 text-sm"
        style={{
          background: "#ede9fe",
          border: "1px solid #7c3aed",
          color: "#4c1d95",
        }}
      >
        ⚠️ <strong>Restricted Access:</strong> These tools perform irreversible operations. All actions are logged.
      </div>

      <DevToolClient adminEmail={user.email} />
    </section>
    </MainLayout>
  );
}

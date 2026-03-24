import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import SettingsForm from "./SettingsForm";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your ExamArchive account settings.",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getServerUser();
  const userName = user?.name || "User";

  if (!user) {
    redirect("/login?next=/settings");
  }

  return (
    <MainLayout
      title="Settings"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userName.substring(0, 2).toUpperCase()}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-2xl bg-surface-container p-6 shadow-lift border border-outline-variant/30">
          <h1 className="text-3xl font-bold text-on-surface">Settings</h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
            Manage your profile, preferences, and account security.
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-5 shadow-lift border border-outline-variant/30">
          <SettingsForm user={user} />
        </div>
      </section>
    </MainLayout>
  );
}

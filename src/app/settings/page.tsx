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
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-slate-50 p-6 shadow-sm ring-1 ring-indigo-100/60 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900 dark:ring-neutral-800">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="mt-2 max-w-2xl text-base text-slate-700 dark:text-slate-300">
            Manage your profile, preferences, and account security.
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-white/95 p-5 shadow ring-1 ring-slate-100 dark:bg-neutral-900 dark:ring-neutral-800">
          <SettingsForm user={user} />
        </div>
      </section>
    </MainLayout>
  );
}

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
      userName={userName}
      userInitials={userName.substring(0, 2).toUpperCase()}
    >
      <section
        className="mx-auto px-4 py-10"
        style={{ maxWidth: "var(--max-w)" }}
      >
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Manage your profile, preferences, and account.
        </p>

        <SettingsForm user={user} />
      </section>
    </MainLayout>
  );
}

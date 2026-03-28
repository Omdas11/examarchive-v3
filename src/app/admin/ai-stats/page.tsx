import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import AiStatsClient from "./AiStatsClient";

export default async function AiStatsPage() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }

  const userName = user.name || user.username || "Admin";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="AI Controls"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "AI Controls" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">AI Requests & Limits</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Monitor RPM/RPD and adjust request limits for all users.
        </p>
        <AiStatsClient />
      </section>
    </MainLayout>
  );
}

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import VerificationsClient from "./VerificationsClient";

export default async function VerificationsPage() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }

  const userName = user.name || user.username || "Admin";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Verification Review"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Verification Review" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">Verification Review</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Corrections reported by users on AI content. Accepting grants the
          reporter +25 XP and +5 credits.
        </p>
        <VerificationsClient />
      </section>
    </MainLayout>
  );
}

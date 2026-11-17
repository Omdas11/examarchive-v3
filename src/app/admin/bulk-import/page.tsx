import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import BulkImportClient from "./BulkImportClient";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata = {
  title: "Bulk Import | Admin",
  robots: { index: false },
};

/**
 * Server-guarded like every other admin page: the old client-only version
 * let any visitor (even logged out) open the bulk-import form UI.
 */
export default async function BulkImportPage() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }
  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();
  return (
    <MainLayout
      title="Bulk Import"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Admin", href: "/admin" }, { label: "Bulk Import" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <BulkImportClient />
    </MainLayout>
  );
}

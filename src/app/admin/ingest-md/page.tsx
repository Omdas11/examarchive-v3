import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import IngestMdClient from "./IngestMdClient";

export default async function AdminIngestMdPage() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    redirect("/");
  }

  const userName = user.name || user.username || "Admin";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Markdown Ingestion"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Ingest Markdown" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold">Admin Markdown Ingestion</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Upload structured Markdown data and ingest it into Syllabus_Table and Questions_Table.
        </p>
        <IngestMdClient />
      </section>
    </MainLayout>
  );
}

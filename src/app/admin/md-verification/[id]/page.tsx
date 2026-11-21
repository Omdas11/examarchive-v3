import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { canAccessMdVerification } from "@/lib/md-verification-access";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import MdVerificationDetail from "./MdVerificationDetail";

export const metadata: Metadata = {
  title: "Verify MD",
  description:
    "Compare a markdown file against its official PDF, side by side.",
};

export default async function AdminMdVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    redirect("/");
  }
  const { id } = await params;
  const userName = user.name || user.username || "Verifier";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Verify MD"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "MD Verification", href: "/admin/md-verification" },
        { label: "Verify" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <MdVerificationDetail itemId={id} />
      </section>
    </MainLayout>
  );
}

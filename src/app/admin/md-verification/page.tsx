import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { isFounder } from "@/lib/roles";
import { canAccessMdVerification } from "@/lib/md-verification-access";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import MdVerificationQueue from "./MdVerificationQueue";

export const metadata: Metadata = {
  title: "MD Verification",
  description:
    "Verify markdown against the official PDF, side by side, for AI Notes grounding.",
};

export default async function AdminMdVerificationPage() {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    redirect("/");
  }

  const userName = user.name || user.username || "Verifier";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="MD Verification"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "MD Verification" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">MD Verification</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Compare each markdown file against its official PDF, fix mistakes
            in place, and approve the clean version. Approved md becomes the
            source of truth for AI Notes. Work in small batches of 5.
          </p>
        </div>
        <MdVerificationQueue isFounder={isFounder(user.role)} />
      </section>
    </MainLayout>
  );
}

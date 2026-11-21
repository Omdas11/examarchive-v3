import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { canAccessMdVerification } from "@/lib/md-verification-access";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import MdVerificationUploadForm from "./MdVerificationUploadForm";

export const metadata: Metadata = {
  title: "Upload for MD Verification",
  description:
    "Upload one zip (paper PDF + markdown) for MD verification, with the emailed 6-character code.",
};

export default async function AdminMdVerificationUploadPage() {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    redirect("/");
  }

  const userName = user.name || user.username || "Verifier";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Upload for verification"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "MD Verification", href: "/admin/md-verification" },
        { label: "Upload" },
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
          <h1 className="text-2xl font-bold">Upload for verification</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            One zip per paper: the official PDF and its markdown file. An
            admin emails you a 6-character code first — it works once, for
            24 hours. If you do not have a code yet, ask an admin to send
            you one.
          </p>
        </div>
        <MdVerificationUploadForm />
      </section>
    </MainLayout>
  );
}

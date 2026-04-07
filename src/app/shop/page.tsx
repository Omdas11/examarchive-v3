import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import ShopPollClient from "./ShopPollClient";

export const metadata: Metadata = {
  title: "Shop | ExamArchive",
  description:
    "Buy AI credits, semester passes, and premium study bundles on ExamArchive.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop | ExamArchive",
    description:
      "Digital products for students: AI credits, semester passes, and premium study bundles.",
    url: "https://www.examarchive.dev/shop",
    type: "website",
  },
};

const products = [
  {
    key: "ai_pdf_short",
    name: "AI PDF Notes",
    description: "Short/medium revision PDFs generated from your selected topics.",
  },
  {
    key: "solved_paper",
    name: "Solved Paper Generation",
    description: "AI-generated solved-paper style guidance for selected paper code/year.",
  },
  {
    key: "premium_notes",
    name: "Premium Typed Notes",
    description: "Editorially formatted notes bundles for high-demand subjects.",
  },
  {
    key: "semester_pass",
    name: "Semester Pass (6 months)",
    description: "Access bundle for semester-level premium resources and utilities.",
  },
];

export default async function ShopPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Shop"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto max-w-[var(--max-w)] px-4 py-10 space-y-6">
        <div className="card p-6">
          <h1 className="text-2xl font-bold">ExamArchive Shop</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            We are finalizing launch pricing. Vote on each item to help set student-friendly pricing tiers.
          </p>
        </div>

        <ShopPollClient products={products} />
      </section>
    </MainLayout>
  );
}

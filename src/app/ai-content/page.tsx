import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import AIContentClient from "./AIContentClient";

export const metadata: Metadata = {
  title: "AI Notes",
  description:
    "Generate AI-powered study notes as a PDF — 1 free PDF per day, then 10 credits per set.",
  keywords: [
    "AI study notes",
    "exam revision generator",
    "paper code notes",
    "ExamArchive AI",
  ],
  alternates: { canonical: "/ai-content" },
  openGraph: {
    title: "AI Notes | ExamArchive",
    description:
      "Create detailed revision notes with syllabus-aware context and structured exam preparation output.",
    url: "https://www.examarchive.dev/ai-content",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default async function AIContentPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?redirect=/ai-content");
  }

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title={
        <>
          AI Notes{" "}
          <span className="ml-1 inline-flex -translate-y-0.5 items-center rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Experimental
          </span>
        </>
      }
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "AI Notes" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <AIContentClient />
    </MainLayout>
  );
}

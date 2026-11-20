import { getServerUser } from "@/lib/auth-cf";
import { AI_NOTES_MAINTENANCE } from "@/lib/site-flags";
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
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const isFounder = user?.role === "founder";
  const underMaintenance = AI_NOTES_MAINTENANCE && !isFounder;

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
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      {underMaintenance ? (
        <div className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/40">
          <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200">
            AI Notes is under maintenance
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            We are upgrading AI Notes with real question papers and syllabus
            content, so the notes match your actual exams. Check back soon.
          </p>
        </div>
      ) : (
        <AIContentClient isLoggedIn={!!user} />
      )}
    </MainLayout>
  );
}

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import AIContentClient from "./AIContentClient";

export const metadata: Metadata = {
  title: "AI Study Notes Generator with Archive Context",
  description:
    "Generate AI-powered detailed study notes with archive context, paper-code guidance, and optional web updates in ExamArchive.",
  keywords: [
    "AI study notes",
    "exam revision generator",
    "paper code notes",
    "ExamArchive AI",
  ],
  alternates: { canonical: "/ai-content" },
  openGraph: {
    title: "AI Study Notes Generator | ExamArchive",
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
    redirect("/login?next=/ai-content");
  }

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="AI Content"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "AI Content" }]}
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

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { getServerUser } from "@/lib/auth";
import StudyClient from "./StudyClient";

export const metadata: Metadata = {
  title: "Study Dashboard | AI Flashcards",
  description: "Generate AI-powered flashcards for any subject or topic and review them instantly.",
  alternates: { canonical: "/study" },
  robots: { index: false, follow: false },
};

export default async function StudyPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/study");
  }

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <MainLayout
      title="Study"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Study" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-on-surface">Study Workspace</h1>
          <p className="text-on-surface-variant">
            Generate AI flashcards tailored to your chosen subject or topic. Track your daily limit and review cards
            instantly.
          </p>
        </header>

        <StudyClient />
      </div>
    </MainLayout>
  );
}

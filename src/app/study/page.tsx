import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";

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
    url: "https://examarchive.dev/ai-content",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default async function StudyPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/ai-content");
  }
  redirect("/ai-content");
}

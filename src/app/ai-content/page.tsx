import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import type { Metadata } from "next";
import AIContentClient from "./AIContentClient";

export const metadata: Metadata = {
  title: "AI Generated Content",
  description:
    "Generate AI-powered study summaries and exam revision documents. ExamBot reads relevant syllabus and paper context to create tailored content.",
  robots: { index: false, follow: false },
};

export default async function AIContentPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/ai-content");
  }

  return <AIContentClient userRole={user.role} />;
}

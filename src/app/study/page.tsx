import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StudyPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/ai-content");
  }
  redirect("/ai-content");
}

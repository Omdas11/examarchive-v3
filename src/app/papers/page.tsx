import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse all PDFs in ExamArchive.",
  robots: { index: false, follow: false },
};

export default async function PapersPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/browse");
  }
  redirect("/browse");
}

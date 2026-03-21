import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import DigitalCuratorDashboard from "@/components/dashboard/DigitalCuratorDashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personalized ExamArchive dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/dashboard");

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <DigitalCuratorDashboard
      userName={userName}
      userInitials={userInitials}
      userRole={user.role}
    />
  );
}

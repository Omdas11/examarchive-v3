import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import SettingsForm from "./SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your ExamArchive account settings.",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login?next=/settings");
  }

  return (
    <section
      className="mx-auto px-4 py-10"
      style={{ maxWidth: "var(--max-w)" }}
    >
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Manage your profile, preferences, and account.
      </p>

      <SettingsForm user={user} />
    </section>
  );
}

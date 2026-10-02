import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import ReplaceFilesClient from "@/components/admin/ReplaceFilesClient";

export const metadata: Metadata = {
  title: "Replace Paper Files",
  description: "Swap a paper's PDF with a cleaned version.",
};

export default async function ReplaceFilesPage() {
  const user = await getServerUser();

  if (!user || !isModerator(user.role)) {
    redirect("/");
  }

  return (
    <MainLayout>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">Replace paper files</h1>
        <p className="mt-2 text-sm opacity-70">
          Attach a cleaned PDF to the matching paper and click Replace. The
          file is uploaded and the paper points at the new copy; the old file
          is deleted.
        </p>
        <ReplaceFilesClient />
      </main>
    </MainLayout>
  );
}

import { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { toSyllabusTableRow } from "@/lib/syllabus-table";
import SyllabusVerificationClient from "./SyllabusVerificationClient";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Syllabus Verification | Admin",
};

export const dynamic = "force-dynamic";

export default async function SyllabusVerificationPage() {
  const user = await getServerUser();
  if (!user || (user.role !== "admin" && user.role !== "founder")) {
    redirect("/");
  }

  const db = adminDatabases();
  const res = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
    Query.equal("status", "pending"),
    Query.limit(100),
  ]);

  const pendingRows = res.documents.map((doc) => toSyllabusTableRow(doc as Record<string, unknown>));

  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <MainLayout
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      userName={userName}
      userInitials={userInitials}
      isLoggedIn={true}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">
            Syllabus Verification
          </h1>
          <p className="mt-2 text-neutral-500 text-lg">
            Review syllabus drafts submitted from the side-website and publish them to students.
          </p>
        </div>

        <SyllabusVerificationClient initialRows={pendingRows} />
      </div>
    </MainLayout>
  );
}

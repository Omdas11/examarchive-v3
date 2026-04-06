import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import SyllabusTrackerClient from "./SyllabusTrackerClient";
import curriculumData from "@/data/curriculum.json";

export const metadata: Metadata = {
  title: "Syllabus Tracker",
  description: "Track syllabus upload progress across all 13 departments and 8 semesters.",
};

export const dynamic = "force-dynamic";

/** Documents fetched per Appwrite page. */
const PAGE_SIZE = 500;

export default async function SyllabusTrackerPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }

  // Fetch all ingested paper codes from Syllabus_Table.
  let db: ReturnType<typeof adminDatabases> | null = null;
  try {
    db = adminDatabases();
  } catch {
    // In local/dev environments without Appwrite env vars, render baseline UI with empty upload state.
    db = null;
  }
  const uploadedMap: Record<string, true> = {};

  async function paginateDistinctCodes(
    collection: string,
  ): Promise<void> {
    let cursor: string | undefined;
    while (true) {
      const queries = [
        Query.limit(PAGE_SIZE),
        Query.select(["paper_code"]),
        Query.orderAsc("paper_code"),
      ];
      if (cursor) queries.push(Query.cursorAfter(cursor));

      if (!db) return;
      const { documents } = await db.listDocuments(DATABASE_ID, collection, queries);
      for (const doc of documents as unknown as Array<{ paper_code?: string }>) {
        const code = doc.paper_code;
        if (!code) continue;
        uploadedMap[code] = true;
      }
      if (documents.length < PAGE_SIZE) break;
      const last = documents[documents.length - 1];
      const nextCursor = (last as { $id?: string }).$id;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }
  }

  try {
    await paginateDistinctCodes(COLLECTION.syllabus_table);
  } catch {
    // Collection may not exist yet
  }

  const userName = user.name || user.username || "Admin";
  const userInitials = userName.slice(0, 2).toUpperCase();
  const userRole = user.role;

  return (
    <MainLayout
      title="Syllabus Tracker"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Admin", href: "/admin" },
        { label: "Syllabus Tracker" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={userRole}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Syllabus Upload Tracker</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tracks the Haflong FYUG baseline as 13 departmental tables plus a master tracking table.
            Uploaded papers are auto-detected, and each paper cell includes a checkbox for manual tracking.
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tracking syllabus of FYUG of all 13 departments of{" "}
            <a
              href="https://haflonggovtcollege.ac.in/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              HAFLONG GOVERNMENT COLLEGE
            </a>
            .
          </p>
        </div>
        <SyllabusTrackerClient
          tables={curriculumData.tables}
          slotOrder={curriculumData.metadata.slotOrder}
          uploadedMap={uploadedMap}
          totalExpected={curriculumData.metadata.totalExpected}
          canEdit={isAdmin(user.role)}
        />
      </section>
    </MainLayout>
  );
}

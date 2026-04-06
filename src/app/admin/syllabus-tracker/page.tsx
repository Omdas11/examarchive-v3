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

/** Maximum pages to paginate per collection (500 docs/page → covers 3 000 rows). */
const MAX_FETCH_PAGES = 6;
/** Documents fetched per Appwrite page. */
const PAGE_SIZE = 500;

export default async function SyllabusTrackerPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }

  // Fetch all ingested paper codes + names.
  // Syllabus_Table now has paper_name (after schema sync) + paper_code.
  // Questions_Table also has paper_name as a fallback.
  // We combine both to determine upload status and populate names.
  let db: ReturnType<typeof adminDatabases> | null = null;
  try {
    db = adminDatabases();
  } catch {
    // In local/dev environments without Appwrite env vars, render baseline UI with empty upload state.
    db = null;
  }
  const uploadedMap: Record<string, string | null> = {};

  async function paginateDistinct(
    collection: string,
    nameField: boolean,
  ): Promise<void> {
    let cursor: string | undefined;
    for (let page = 0; page < MAX_FETCH_PAGES; page++) {
      const fields = nameField
        ? ["paper_code", "paper_name"]
        : ["paper_code"];
      const queries = [
        Query.limit(PAGE_SIZE),
        Query.select(fields),
        Query.orderAsc("paper_code"),
      ];
      if (cursor) queries.push(Query.cursorAfter(cursor));

      if (!db) return;
      const { documents } = await db.listDocuments(DATABASE_ID, collection, queries);
      for (const doc of documents as unknown as Array<{ paper_code?: string; paper_name?: string }>) {
        const code = doc.paper_code;
        if (!code) continue;
        if (!(code in uploadedMap)) {
          // First time seeing this code – use paper_name if available
          uploadedMap[code] = (nameField ? doc.paper_name : null) ?? null;
        } else if (nameField && doc.paper_name && !uploadedMap[code]) {
          // Enrich with a name if we got one later
          uploadedMap[code] = doc.paper_name;
        }
      }
      if (documents.length < PAGE_SIZE) break;
      const last = documents[documents.length - 1];
      cursor = (last as { $id?: string }).$id;
    }
  }

  try {
    // Syllabus_Table: gives upload presence (no paper_name)
    await paginateDistinct(COLLECTION.syllabus_table, false);
  } catch {
    // Collection may not exist yet
  }
  try {
    // Questions_Table: gives paper_name
    await paginateDistinct(COLLECTION.questions_table, true);
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

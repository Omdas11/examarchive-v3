import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import type { Paper } from "@/types";
import { toPaper } from "@/types";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import BrowseClient from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse Question Papers by Course, Year, Semester",
  description:
    "Browse and filter past exam question papers by university, course code, semester, paper type, and year on ExamArchive.",
  keywords: [
    "browse question papers",
    "past exam papers",
    "course code papers",
    "FYUGP papers",
    "CBCS papers",
    "ExamArchive browse",
  ],
  alternates: { canonical: "/browse" },
  openGraph: {
    title: "Browse Question Papers | ExamArchive",
    description:
      "Find verified past exam papers using filters for course code, university, semester, and year.",
    url: "https://examarchive.dev/browse",
    type: "website",
  },
};

interface BrowsePageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { q } = await searchParams;
  const user = await getServerUser();
  const isAdmin = user?.role === "admin" || user?.role === "moderator" || user?.role === "founder";

  let papers: Paper[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      [Query.equal("approved", true), Query.orderDesc("$createdAt"), Query.limit(500)],
    );
    papers = documents.map(toPaper);
  } catch {
    // collection may not exist yet
  }

  // Compute distinct years, streams, paper types, and universities from the fetched papers
  const yearSet = new Set<number>();
  const streamSet = new Set<string>();
  const paperTypeSet = new Set<string>();
  const universitySet = new Set<string>();
  for (const p of papers) {
    if (p.year) yearSet.add(p.year);
    if (p.department) {
      const upper = p.department.toUpperCase();
      if (upper.includes("SCIENCE")) streamSet.add("SCIENCE");
      else if (upper.includes("ARTS")) streamSet.add("ARTS");
      else if (upper.includes("COMMERCE")) streamSet.add("COMMERCE");
      else streamSet.add(p.department.toUpperCase());
    }
    if (p.paper_type) paperTypeSet.add(p.paper_type);
    if (p.institution) universitySet.add(p.institution);
  }
  const availableYears = [...yearSet].sort((a, b) => b - a);
  const availableStreams = [...streamSet].sort();
  const availablePaperTypes = [...paperTypeSet].sort();
  const availableUniversities = [...universitySet].sort();

  return (
    <MainLayout
      title="Browse Papers"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Browse" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      userName={user?.name ?? "Guest"}
      userInitials={(user?.name ?? "Guest").slice(0, 2).toUpperCase()}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">Browse Question Papers</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Search and filter past exam papers by programme, stream, and year.
        </p>

        <BrowseClient
          initialPapers={papers}
          availableYears={availableYears}
          availableStreams={availableStreams}
          availablePaperTypes={availablePaperTypes}
          availableUniversities={availableUniversities}
          isAdmin={isAdmin}
          initialSearch={q ?? ""}
        />
      </section>
    </MainLayout>
  );
}

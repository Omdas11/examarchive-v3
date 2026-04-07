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
  title: "Browse by Course, Year, Semester",
  description:
    "Browse and filter past exam question papers by university, course code, semester, paper type, and year on ExamArchive.",
  keywords: [
    "browse question papers",
    "past exam papers",
    "course code papers",
    "FYUGP papers",
    "ExamArchive browse",
  ],
  alternates: { canonical: "/browse" },
  openGraph: {
    title: "Browse | ExamArchive",
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
  const userName = user?.name || "Guest";
  const userInitials = user ? userName.substring(0, 2).toUpperCase() : "";
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
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-2xl bg-surface-container p-6 shadow-lift border border-outline-variant/30">
          <h1 className="text-3xl font-bold text-on-surface">Browse</h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant">
            Quickly search and filter past papers by programme, stream, and year. Pick a paper to inspect or use it as reference for AI notes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-on-surface">
            <span className="rounded-full bg-surface px-3 py-1 border border-outline-variant/30">
              Library
            </span>
            <span className="rounded-full bg-surface px-3 py-1 border border-outline-variant/30">
              Updated daily
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-4 shadow-lift border border-outline-variant/30">
          <BrowseClient
            initialPapers={papers}
            availableYears={availableYears}
            availableStreams={availableStreams}
            availablePaperTypes={availablePaperTypes}
            availableUniversities={availableUniversities}
            isAdmin={isAdmin}
            initialSearch={q ?? ""}
          />
        </div>
      </section>
    </MainLayout>
  );
}

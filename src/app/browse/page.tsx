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
import { isModerator } from "@/lib/roles";
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
  searchParams: Promise<{ q?: string; department?: string; year?: string; semester?: string; programme?: string }>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { q, department, year, semester, programme } = await searchParams;
  const user = await getServerUser();
  const userName = user?.name || "Guest";
  const userInitials = user ? userName.substring(0, 2).toUpperCase() : "";
  const isAdmin = user ? isModerator(user.role) : false;

  let papers: Paper[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      [Query.equal("approved", true), Query.orderDesc("$createdAt"), Query.limit(500)],
    );
    papers = documents.map(toPaper);
  } catch (err) {
    console.error("[browse] Failed to fetch approved papers:", err);
    // collection may not exist yet or index is missing
  }

  // Compute distinct years, streams, paper types, universities, and semesters from the fetched papers
  const yearSet = new Set<number>();
  const streamSet = new Set<string>();
  const paperTypeSet = new Set<string>();
  const universitySet = new Set<string>();
  const semesterSet = new Set<string>();
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
    if (p.institute) universitySet.add(p.institute);
    if (p.semester) semesterSet.add(p.semester);
  }
  const availableYears = [...yearSet].sort((a, b) => b - a);
  const availableStreams = [...streamSet].sort();
  const availablePaperTypes = [...paperTypeSet].sort();
  const availableUniversities = [...universitySet].sort();
  const availableSemesters = [...semesterSet].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  // HGC/FYUGP focus: when papers from Haflong Government College exist in the
  // archive, default the browse view to them so students land on relevant content.
  const defaultUniversity =
    availableUniversities.find((u) => u.toLowerCase().includes("haflong")) ?? null;

  // Normalize semester URL param: "4" → "4th" to match stored values
  let normalizedSemester: string | null = null;
  if (semester) {
    const num = parseInt(semester, 10);
    if (!Number.isNaN(num) && String(num) === semester.trim()) {
      const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
      const candidate = `${num}${suffix}`;
      normalizedSemester = availableSemesters.includes(candidate) ? candidate : semester;
    } else {
      normalizedSemester = semester;
    }
  }

  return (
    <MainLayout
      title="Browse Papers"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Browse" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "guest"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-6 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-[2rem] bg-surface p-8 shadow-lift border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-full -mr-10 -mt-10 blur-2xl" />
          <h1 className="text-3xl font-black text-on-surface tracking-tight">Browse Archive</h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-on-surface-variant/80">
            Search and filter our verified collection of past exam papers. Access metadata freely and sign in to view the full PDF archive.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="rounded-full bg-primary-fixed text-primary px-4 py-1.5 border border-primary/10 shadow-sm">
              Community Library
            </span>
            <span className="rounded-full bg-secondary-container text-secondary px-4 py-1.5 border border-secondary/10 shadow-sm">
              Daily Updates
            </span>
          </div>
        </div>

        <div className="mt-8 rounded-[2rem] bg-surface p-6 shadow-ambient border border-outline-variant/5">
          <BrowseClient
            initialPapers={papers}
            availableYears={availableYears}
            availableStreams={availableStreams}
            availablePaperTypes={availablePaperTypes}
            availableUniversities={availableUniversities}
            availableSemesters={availableSemesters}
            defaultUniversity={defaultUniversity}
            isAdmin={isAdmin}
            initialSearch={q ?? ""}
            initialDepartment={department ?? null}
            initialYear={year ? parseInt(year, 10) : null}
            initialSemester={normalizedSemester}
            initialProgramme={programme ?? "ALL"}
          />
        </div>
      </section>
    </MainLayout>
  );
}

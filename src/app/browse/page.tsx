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
import BrowseClient from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse Papers",
  description: "Search and filter past exam papers by department, course, year and more.",
};

export default async function BrowsePage() {
  const user = await getServerUser();
  const isAdmin = user?.role === "admin" || user?.role === "moderator";

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

  // Compute distinct years and streams from the fetched papers
  const yearSet = new Set<number>();
  const streamSet = new Set<string>();
  for (const p of papers) {
    if (p.year) yearSet.add(p.year);
    if (p.department) {
      const upper = p.department.toUpperCase();
      if (upper.includes("SCIENCE")) streamSet.add("SCIENCE");
      else if (upper.includes("ARTS")) streamSet.add("ARTS");
      else if (upper.includes("COMMERCE")) streamSet.add("COMMERCE");
      else streamSet.add(p.department.toUpperCase());
    }
  }
  const availableYears = [...yearSet].sort((a, b) => b - a);
  const availableStreams = [...streamSet].sort();

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Browse Question Papers</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Search and filter past exam papers by programme, stream, and year.
      </p>

      <BrowseClient
        initialPapers={papers}
        availableYears={availableYears}
        availableStreams={availableStreams}
        isAdmin={isAdmin}
      />
    </section>
  );
}


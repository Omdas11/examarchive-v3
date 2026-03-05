import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import PaperCard from "@/components/PaperCard";
import type { Paper } from "@/types";
import { toPaper } from "@/types";

export const metadata: Metadata = {
  title: "Browse Papers",
  description: "Search and filter past exam papers by department, course, year and more.",
};

interface BrowseSearchParams {
  department?: string;
  course_code?: string;
  year?: string;
  semester?: string;
  exam_type?: string;
  search?: string;
}

const programmes = ["ALL", "CBCS", "FYUG"];
const streams = ["SCIENCE", "ARTS", "COMMERCE"];
const years = ["2020", "2021", "2022", "2023", "2024"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<BrowseSearchParams>;
}) {
  const params = await searchParams;

  const queries: string[] = [
    Query.equal("approved", true),
    Query.orderDesc("$createdAt"),
  ];

  if (params.department) queries.push(Query.equal("department", params.department));
  if (params.course_code) queries.push(Query.equal("course_code", params.course_code));
  if (params.year) queries.push(Query.equal("year", Number(params.year)));
  if (params.semester) queries.push(Query.equal("semester", params.semester));
  if (params.exam_type) queries.push(Query.equal("exam_type", params.exam_type));
  if (params.search) queries.push(Query.search("title", params.search));

  let papers: Paper[] = [];
  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.papers,
      queries,
    );
    papers = documents.map(toPaper);
  } catch {
    // collection may not exist yet
  }

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Browse Question Papers</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Search and filter past exam papers by programme, stream, and year.
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {papers ? papers.length : 0} paper(s) found
      </p>

      {/* Programme toggles */}
      <div className="mt-6 flex flex-wrap gap-2">
        {programmes.map((p) => (
          <span key={p} className={`toggle-btn ${p === "ALL" ? "active" : ""}`}>{p}</span>
        ))}
      </div>

      {/* Stream toggles */}
      <div className="mt-3 flex flex-wrap gap-2">
        {streams.map((s) => (
          <span key={s} className="toggle-btn">{s}</span>
        ))}
      </div>

      {/* Year toggles */}
      <div className="mt-3 flex flex-wrap gap-2">
        {years.map((y) => (
          <span key={y} className="toggle-btn">{y}</span>
        ))}
      </div>

      {/* Search + sort row */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search papers…"
          defaultValue={params.search ?? ""}
          className="input-field flex-1"
        />
        <span className="toggle-btn">Sort ▾</span>
      </div>

      {/* Papers grid */}
      {papers && papers.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {papers.map((p: Paper) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <svg className="mx-auto h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>No papers found.</p>
        </div>
      )}
    </section>
  );
}

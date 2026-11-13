import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Platform Stats",
  description: "Live ExamArchive platform statistics.",
};

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

/** Fetch all platform stats from Appwrite — cached for 24h: the syllabus
 * walk below reads all 506 syllabus documents on every call. */
const fetchPlatformStats = unstable_cache(
  async () => {
  const db = adminDatabases();

  const [
    papersApproved,
    papersPending,
    papersTotal,
    syllabusApproved,
    syllabusTotal,
    usersTotal,
  ] = await Promise.allSettled([
    db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("approved", true),
      Query.limit(1),
    ]),
    db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("approved", false),
      Query.limit(1),
    ]),
    db.listDocuments(DATABASE_ID, COLLECTION.papers, [Query.limit(1)]),
    db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
      Query.equal("approval_status", "approved"),
      Query.limit(1),
    ]),
    db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [Query.limit(1)]),
    db.listDocuments(DATABASE_ID, COLLECTION.users, [Query.limit(1)]),
  ]);

  // Walk all approved syllabi to compute subject/code coverage without a hard cap.
  // The catalogue lives in Syllabus_Table (one row per unit), so dedupe by
  // subject and paper_code. The legacy `syllabus` collection is empty in the
  // new project.
  let syllabusSubjects = 0;
  let syllabusCodes = 0;
  try {
    const subjects = new Set<string>();
    const codes = new Set<string>();
    let cursor: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queries = [Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const page = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, queries);
      for (const doc of page.documents) {
        const subj = (doc.subject as string | undefined)?.trim();
        const code = (doc.paper_code as string | undefined)?.trim();
        if (subj) subjects.add(subj);
        if (code) codes.add(code);
      }
      if (page.documents.length < 100) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
    syllabusSubjects = subjects.size;
    syllabusCodes = codes.size;
  } catch {
    syllabusSubjects = 0;
    syllabusCodes = 0;
  }

  // Distinct syllabus papers in Syllabus_Table (one row per unit, so dedupe
  // by paper_code). This is the real syllabus catalogue the site serves.
  let syllabusTablePapers = 0;
  try {
    const codes = new Set<string>();
    let cursor: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queries = [Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const page = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.syllabus_table,
        queries,
      );
      for (const doc of page.documents) {
        const code = (doc.paper_code as string | undefined)?.trim();
        if (code) codes.add(code);
      }
      if (page.documents.length < 100) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
    syllabusTablePapers = codes.size;
  } catch {
    syllabusTablePapers = 0;
  }

  // Visitor counts for the last 24 hours, bucketed by hour (IST).
  // visit_logs stores one row per page view with $createdAt.
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hourlyVisitors: number[] = Array.from({ length: 24 }, () => 0);
  let visitors24h = 0;
  try {
    let cursor: string | undefined;
    let fetched = 0;
    // eslint-disable-next-line no-constant-condition
    while (fetched < 1000) {
      const queries = [
        Query.greaterThan("$createdAt", dayAgo.toISOString()),
        Query.orderAsc("$createdAt"),
        Query.limit(100),
      ];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const page = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.visit_logs,
        queries,
      );
      for (const doc of page.documents) {
        visitors24h += 1;
        const created = new Date(doc.$createdAt as string).getTime();
        const hourIndex = Math.floor((created - dayAgo.getTime()) / (60 * 60 * 1000));
        if (hourIndex >= 0 && hourIndex < 24) {
          hourlyVisitors[hourIndex] += 1;
        }
      }
      fetched += page.documents.length;
      if (page.documents.length < 100) break;
      cursor = page.documents[page.documents.length - 1].$id;
    }
  } catch {
    visitors24h = 0;
  }

  const papersApprovedCount =
    papersApproved.status === "fulfilled" ? Number(papersApproved.value.total) : 0;
  const usersCount =
    usersTotal.status === "fulfilled" ? Number(usersTotal.value.total) : 0;
  // Total pages on the site: approved papers + distinct syllabus papers +
  // study-notes units (20). Static routes (home, browse, about, ...) are
  // not counted — this is the content-page total.
  const NOTES_UNITS = 20;
  const totalPages = papersApprovedCount + syllabusTablePapers + NOTES_UNITS;

  return {
    papersApproved: papersApprovedCount,
    papersPending:
      papersPending.status === "fulfilled" ? Number(papersPending.value.total) : 0,
    papersTotal:
      papersTotal.status === "fulfilled" ? Number(papersTotal.value.total) : 0,
    syllabusApproved:
      syllabusApproved.status === "fulfilled"
        ? Number(syllabusApproved.value.total)
        : 0,
    syllabusTotal:
      syllabusTotal.status === "fulfilled" ? Number(syllabusTotal.value.total) : 0,
    usersTotal: usersCount,
    syllabusSubjects,
    syllabusCodes,
    syllabusTablePapers,
    totalPages,
    visitors24h,
    hourlyVisitors,
    notesUnits: NOTES_UNITS,
  };
  },
  ["platform-stats-v3"],
  { revalidate: 86400 },
);

export default async function StatsPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/stats");
  }
  const userName = user.name || user.username || "Scholar";
  const userInitials = userName.slice(0, 2).toUpperCase();

  const stats = await fetchPlatformStats();

  const cards: StatCard[] = [
    {
      label: "Total Pages",
      value: stats.totalPages,
      sub: `${stats.papersApproved} papers + ${stats.syllabusTablePapers} syllabus + ${stats.notesUnits} notes`,
      accent: true,
    },
    {
      label: "Published Papers",
      value: stats.papersApproved,
      sub: `${stats.papersTotal} total (incl. pending)`,
      accent: true,
    },
    {
      label: "Pending Papers",
      value: stats.papersPending,
      sub: "Awaiting moderation",
    },
    {
      label: "Syllabi Available",
      value: stats.syllabusTablePapers,
      sub: "Syllabus papers in the catalogue",
      accent: true,
    },
    {
      label: "Registered Users",
      value: stats.usersTotal,
      sub: "All-time sign-ups",
      accent: true,
    },
    {
      label: "Visitors (24h)",
      value: stats.visitors24h,
      sub: "Page views, last 24 hours",
      accent: true,
    },
  ];

  const hasModAccess = isModerator(user.role);

  // Hour labels for the 24h graph (IST), oldest hour first.
  const now = new Date();
  const hourLabels = stats.hourlyVisitors.map((_, i) => {
    const d = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return d.toLocaleString("en-IN", {
      hour: "numeric",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  });
  const maxHourly = Math.max(1, ...stats.hourlyVisitors);

  return (
    <MainLayout
      title="Stats"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Stats" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userInitials}
    >
    <section
      className="mx-auto px-4 py-10"
      style={{ maxWidth: "var(--max-w)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Platform Stats</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Live statistics pulled directly from the database.
          </p>
        </div>
        {hasModAccess && (
          <Link
            href="/admin"
            className="btn text-sm"
          >
            Admin Panel →
          </Link>
        )}
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 text-center">
            <p
              className="text-3xl font-bold"
              style={{ color: c.accent ? "var(--color-primary)" : "var(--color-text)" }}
            >
              {c.value}
            </p>
            <p className="mt-1 text-sm font-medium">{c.label}</p>
            {c.sub && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {c.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Visitors, last 24 hours — hourly bar chart */}
      <h2 className="mt-10 text-lg font-semibold">Visitors — Last 24 Hours</h2>
      <p className="mt-1 text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Page views per hour (IST). Total {stats.visitors24h} in the last 24 hours.
      </p>
      <div className="card p-5">
        <div className="flex items-end gap-1" style={{ height: "140px" }} role="img" aria-label={`Visitors per hour, last 24 hours, total ${stats.visitors24h}`}>
          {stats.hourlyVisitors.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${hourLabels[i]}: ${count} view${count === 1 ? "" : "s"}`}>
              <span className="text-[10px] font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
                {count > 0 ? count : ""}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(count > 0 ? 6 : 2, (count / maxHourly) * 100)}px`,
                  background: count > 0 ? "var(--color-primary)" : "var(--color-surface-container)",
                  opacity: count > 0 ? 1 : 0.5,
                }}
              />
              <span className="text-[9px] mt-1 truncate" style={{ color: "var(--color-text-muted)" }}>
                {i % 3 === 0 ? hourLabels[i] : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live syllabus stats */}
      <h2 className="mt-10 text-lg font-semibold">Syllabus Coverage</h2>
      <p className="mt-1 text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Live counts computed from approved syllabi in Appwrite.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{stats.syllabusTablePapers}</p>
          <p className="mt-1 text-sm font-medium">Syllabus Papers</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold">{stats.syllabusSubjects}</p>
          <p className="mt-1 text-sm font-medium">Subjects Covered</p>
        </div>
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold">{stats.syllabusCodes}</p>
          <p className="mt-1 text-sm font-medium">Paper Codes</p>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
        Stats refresh on each page load. Only visible to logged-in users.
      </p>
    </section>
    </MainLayout>
  );
}

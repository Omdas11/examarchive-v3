import type { Metadata } from "next";
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

/** Fetch all platform stats from Appwrite. */
async function fetchPlatformStats() {
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

  // Walk all approved syllabi to compute subject/code coverage without a hard cap
  let syllabusSubjects = 0;
  let syllabusCodes = 0;
  try {
    const subjects = new Set<string>();
    const codes = new Set<string>();
    let cursor: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queries = [
        Query.equal("approval_status", "approved"),
        Query.limit(100),
      ];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const page = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus, queries);
      for (const doc of page.documents) {
        const subj = (doc.subject as string | undefined)?.trim();
        const code = (doc.course_code as string | undefined)?.trim();
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

  return {
    papersApproved:
      papersApproved.status === "fulfilled" ? papersApproved.value.total : 0,
    papersPending:
      papersPending.status === "fulfilled" ? papersPending.value.total : 0,
    papersTotal:
      papersTotal.status === "fulfilled" ? papersTotal.value.total : 0,
    syllabusApproved:
      syllabusApproved.status === "fulfilled"
        ? syllabusApproved.value.total
        : 0,
    syllabusTotal:
      syllabusTotal.status === "fulfilled" ? syllabusTotal.value.total : 0,
    usersTotal:
      usersTotal.status === "fulfilled" ? usersTotal.value.total : 0,
    syllabusSubjects,
    syllabusCodes,
  };
}

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
      value: stats.syllabusApproved,
      sub: `${stats.syllabusTotal} total (incl. pending)`,
      accent: true,
    },
    {
      label: "Registered Users",
      value: stats.usersTotal,
      sub: "All-time sign-ups",
      accent: true,
    },
  ];

  const hasModAccess = isModerator(user.role);

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {/* Live syllabus stats */}
      <h2 className="mt-10 text-lg font-semibold">Syllabus Coverage</h2>
      <p className="mt-1 text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Live counts computed from approved syllabi in Appwrite.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5 text-center">
          <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{stats.syllabusApproved}</p>
          <p className="mt-1 text-sm font-medium">Approved Syllabi</p>
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

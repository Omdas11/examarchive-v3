import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";
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

/** Fetch all platform stats from D1. The syllabus aggregates are single
 * COUNT(DISTINCT ...) queries — no row pagination walks. */
async function fetchPlatformStats() {
  const db = await getD1();

  const [
    papersApproved,
    papersPending,
    papersTotal,
    syllabusApproved,
    syllabusTotal,
    usersTotal,
    syllabusAgg,
    syllabusTablePapers,
  ] = await Promise.all([
    db
      .prepare("SELECT COUNT(*) AS n FROM papers WHERE approved = 1")
      .first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM papers WHERE approved = 0")
      .first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM papers").first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM syllabus WHERE approval_status = 'approved'")
      .first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM syllabus").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(DISTINCT subject) AS subjects, COUNT(DISTINCT paper_code) AS codes FROM syllabus_table",
      )
      .first<{ subjects: number; codes: number }>(),
    db
      .prepare("SELECT COUNT(DISTINCT paper_code) AS n FROM syllabus_table")
      .first<{ n: number }>(),
  ]);

  const syllabusSubjects = Number(syllabusAgg?.subjects ?? 0);
  const syllabusCodes = Number(syllabusAgg?.codes ?? 0);
  const syllabusTablePapersCount = Number(syllabusTablePapers?.n ?? 0);

  // Visitor counts for the last 24 hours, bucketed by hour (IST).
  // visit_logs stores one row per page view with created_at (epoch ms).
  const now = new Date();
  const dayAgoMs = now.getTime() - 24 * 60 * 60 * 1000;
  const hourlyVisitors: number[] = Array.from({ length: 24 }, () => 0);
  let visitors24h = 0;
  try {
    const { results } = await db
      .prepare(
        "SELECT created_at FROM visit_logs WHERE created_at >= ? ORDER BY created_at ASC LIMIT 1000",
      )
      .bind(dayAgoMs)
      .all<{ created_at: number }>();
    for (const row of results ?? []) {
      visitors24h += 1;
      const hourIndex = Math.floor((row.created_at - dayAgoMs) / (60 * 60 * 1000));
      if (hourIndex >= 0 && hourIndex < 24) {
        hourlyVisitors[hourIndex] += 1;
      }
    }
  } catch {
    visitors24h = 0;
  }

  const papersApprovedCount = Number(papersApproved?.n ?? 0);
  const usersCount = Number(usersTotal?.n ?? 0);
  // Total pages on the site: approved papers + distinct syllabus papers +
  // study-notes units (20). Static routes (home, browse, about, ...) are
  // not counted — this is the content-page total.
  const NOTES_UNITS = 20;
  const totalPages = papersApprovedCount + syllabusTablePapersCount + NOTES_UNITS;

  return {
    papersApproved: papersApprovedCount,
    papersPending: Number(papersPending?.n ?? 0),
    papersTotal: Number(papersTotal?.n ?? 0),
    syllabusApproved: Number(syllabusApproved?.n ?? 0),
    syllabusTotal: Number(syllabusTotal?.n ?? 0),
    usersTotal: usersCount,
    syllabusSubjects,
    syllabusCodes,
    syllabusTablePapers: syllabusTablePapersCount,
    totalPages,
    visitors24h,
    hourlyVisitors,
    notesUnits: NOTES_UNITS,
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
      label: "Page views (24h)",
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
        Stats update once a day. Only visible to logged-in users.
      </p>
    </section>
    </MainLayout>
  );
}

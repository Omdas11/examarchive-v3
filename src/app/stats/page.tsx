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
import { SYLLABUS_REGISTRY } from "@/data/syllabus-registry";

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
  };
}

export default async function StatsPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/login?next=/stats");
  }

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

      {/* Registry stats (static data) */}
      <h2 className="mt-10 text-lg font-semibold">Syllabus Registry</h2>
      <p className="mt-1 text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        Built-in paper registry (local data — always available offline).
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <RegistryStats />
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-center" style={{ color: "var(--color-text-muted)" }}>
        Stats refresh on each page load. Only visible to logged-in users.
      </p>
    </section>
  );
}

/** Registry counts are static — computed at render time from local data. */
function RegistryStats() {
  const total = SYLLABUS_REGISTRY.length;
  const withUnits = SYLLABUS_REGISTRY.filter((e) => (e.units?.length ?? 0) > 0).length;
  const subjects = new Set(SYLLABUS_REGISTRY.map((e) => e.subject)).size;

  const registryCards = [
    { label: "Registry Entries", value: total },
    { label: "With Full Units", value: withUnits },
    { label: "Subjects Covered", value: subjects },
  ];

  return (
    <>
      {registryCards.map((c) => (
        <div key={c.label} className="card p-5 text-center">
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--color-primary)" }}
          >
            {c.value}
          </p>
          <p className="mt-1 text-sm font-medium">{c.label}</p>
        </div>
      ))}
    </>
  );
}

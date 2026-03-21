import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about ExamArchive and how it works.",
};

/** SVG icons for each workflow step */
const STEP_ICONS = [
  // Upload – arrow pointing up from tray
  <svg key="upload" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>,
  // Review – clipboard with checkmark
  <svg key="review" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>,
  // Publish – globe / broadcast
  <svg key="publish" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>,
  // Discover – magnifying glass over document
  <svg key="discover" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>,
];

const steps = [
  { icon: STEP_ICONS[0], title: "Upload", desc: "Students upload past question papers and notes." },
  { icon: STEP_ICONS[1], title: "Review", desc: "Admins review and verify each submission." },
  { icon: STEP_ICONS[2], title: "Publish", desc: "Approved papers are published to the archive." },
  { icon: STEP_ICONS[3], title: "Discover", desc: "Anyone can browse and download freely." },
];

const contributions = [
  "Upload question papers you have access to.",
  "Report incorrect or duplicate papers.",
  "Share the platform with fellow students.",
  "Provide feedback to help us improve.",
  "Apply to become a moderator or admin.",
];

/** XP tier progression data — matches the profile module exactly. */
const XP_TIERS = [
  { xp: 0,    level: 0,   title: "Visitor",     color: "#6b7280" },
  { xp: 100,  level: 5,   title: "Explorer",    color: "#2563eb" },
  { xp: 300,  level: 10,  title: "Contributor", color: "#16a34a" },
  { xp: 800,  level: 25,  title: "Veteran",     color: "#d97706" },
  { xp: 1500, level: 50,  title: "Senior",      color: "#9333ea" },
  { xp: 3000, level: 90,  title: "Elite",       color: "#db2777" },
  { xp: 5000, level: 100, title: "Legend",      color: "#dc2626" },
];

/** System roles with descriptions. */
const SYSTEM_ROLES = [
  {
    name: "Student",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    ),
    color: "#6b7280",
    desc: "Default role for all registered users. Can upload papers and syllabi pending admin approval.",
  },
  {
    name: "Moderator",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    color: "#e65100",
    desc: "Trusted community members who can approve or reject paper and syllabus submissions.",
  },
  {
    name: "Admin",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
    ),
    color: "#d32f2f",
    desc: "Full platform management including user roles, paper moderation, and activity logs.",
  },
  {
    name: "Founder",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    color: "#7c3aed",
    desc: "Platform creator with full access including developer tools and system-level operations.",
  },
];

/** Community (custom) roles that can be assigned alongside the primary role. */
const COMMUNITY_ROLES = [
  {
    name: "Contributor",
    desc: "Consistently uploads high-quality papers",
    color: "#2563eb",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    name: "Reviewer",
    desc: "Helps review and verify uploaded content",
    color: "#0891b2",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
      </svg>
    ),
  },
  {
    name: "Curator",
    desc: "Organises and categorises the archive",
    color: "#7c3aed",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    name: "Mentor",
    desc: "Guides new users on the platform",
    color: "#059669",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    name: "Archivist",
    desc: "Focuses on rare or historical papers",
    color: "#b45309",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
      </svg>
    ),
  },
  {
    name: "Ambassador",
    desc: "Promotes ExamArchive in their institution",
    color: "#0284c7",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
      </svg>
    ),
  },
  {
    name: "Pioneer",
    desc: "Among the earliest active contributors",
    color: "#9333ea",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    name: "Researcher",
    desc: "Contributes to platform research & development",
    color: "#16a34a",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
];

/** XP award amounts per event. */
const XP_EVENTS = [
  { event: "Paper approved by moderator", xp: "+50" },
  { event: "First ever upload",           xp: "+20 bonus" },
  { event: "7-day streak reached",        xp: "+100 bonus" },
  { event: "30-day streak reached",       xp: "+500 bonus" },
];

/** Fetch live platform statistics from Appwrite. Falls back to 0 on error. */
async function fetchStats() {
  try {
    const db = adminDatabases();
    const [papersRes, syllabusRes, usersRes] = await Promise.allSettled([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
        Query.equal("approval_status", "approved"),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.users, [Query.limit(1)]),
    ]);

    const papers =
      papersRes.status === "fulfilled" ? papersRes.value.total : 0;
    const syllabi =
      syllabusRes.status === "fulfilled" ? syllabusRes.value.total : 0;
    const users =
      usersRes.status === "fulfilled" ? usersRes.value.total : 0;

    return { papers, syllabi, users };
  } catch {
    return { papers: 0, syllabi: 0, users: 0 };
  }
}

export default async function AboutPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const { papers, syllabi, users } = await fetchStats();

  const stats = [
    { label: "Published Papers", value: papers > 0 ? `${papers}+` : "0+" },
    { label: "Contributors", value: users > 0 ? `${users}+` : "0+" },
    { label: "Syllabi Available", value: syllabi > 0 ? `${syllabi}+` : "0+" },
    { label: "Free & Open", value: "100%" },
  ];

  return (
    <MainLayout
      title="About"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Intro */}
      <h1 className="text-2xl font-bold">About ExamArchive</h1>
      <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <p>
          ExamArchive is a community-driven platform that collects and organizes past exam question
          papers, syllabi, and academic resources for students.
        </p>
        <p>
          Our goal is to make exam preparation easier by providing free and open access to question
          papers from various universities, programmes, and streams.
        </p>
      </div>

      {/* How It Works */}
      <h2 className="mt-10 text-xl font-semibold">How It Works</h2>
      <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-0">
        {steps.map((s, idx) => (
          <div key={s.title} className="flex flex-col sm:flex-row items-center flex-1 min-w-0">
            {/* Step card */}
            <div className="card p-5 text-center flex-1 w-full sm:min-w-0">
              <span
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
              >
                {s.icon}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.desc}</p>
            </div>
            {/* Arrow connector between steps */}
            {idx < steps.length - 1 && (
              <>
                {/* Horizontal arrow on sm+ screens */}
                <svg
                  className="hidden sm:block shrink-0 mx-1"
                  width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "var(--color-primary)", opacity: 0.5 }}
                >
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
                {/* Vertical arrow on mobile */}
                <svg
                  className="block sm:hidden my-1"
                  width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "var(--color-primary)", opacity: 0.5 }}
                >
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <polyline points="5 12 12 19 19 12"/>
                </svg>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Platform Stats */}
      <h2 className="mt-10 text-xl font-semibold">Platform Stats</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Community Roles */}
      <h2 className="mt-10 text-xl font-semibold">Community Roles</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        ExamArchive uses a layered role system. Every user starts as a Student and can earn
        higher roles through quality contributions and community trust.
      </p>

      {/* System roles */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SYSTEM_ROLES.map((r) => (
          <div key={r.name} className="card p-4 flex items-start gap-3">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${r.color}18`, color: r.color }}
            >
              {r.icon}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{r.name}</p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {r.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Community / custom roles */}
      <h3 className="mt-6 text-base font-semibold">Community Designations</h3>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
        These optional secondary roles recognise specific contributions. They are cosmetic and
        do not change permissions.
      </p>
      <div className="mt-3 space-y-2">
        {COMMUNITY_ROLES.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 rounded-xl px-4 py-3 w-full"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: `${r.color}18`, color: r.color }}
            >
              {r.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: r.color }}>{r.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* XP & Progression */}
      <h2 className="mt-10 text-xl font-semibold">XP & Progression</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Earn XP by contributing to the archive. XP unlocks cosmetic rank titles and avatar ring
        colours on your profile — it does not affect permissions.
      </p>

      {/* XP tier table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-left" style={{ color: "var(--color-text-muted)" }}>
              <th className="pb-2 pr-4 font-medium">Rank</th>
              <th className="pb-2 pr-4 font-medium">XP Required</th>
              <th className="pb-2 font-medium">Level</th>
            </tr>
          </thead>
          <tbody>
            {XP_TIERS.map((t) => (
              <tr
                key={t.title}
                className="border-t"
                style={{ borderColor: "var(--color-border)" }}
              >
                <td className="py-2 pr-4">
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{ background: `${t.color}18`, color: t.color }}
                  >
                    {t.title}
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {t.xp === 0 ? "0" : `${t.xp.toLocaleString()} XP`}
                </td>
                <td className="py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {t.level}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* XP awards */}
      <h3 className="mt-6 text-base font-semibold">How to Earn XP</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {XP_EVENTS.map((e) => (
          <div
            key={e.event}
            className="card flex items-center justify-between gap-3 px-4 py-3"
          >
            <p className="text-sm">{e.event}</p>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {e.xp}
            </span>
          </div>
        ))}
      </div>

      {/* How to Contribute */}
      <h2 className="mt-10 text-xl font-semibold">How to Contribute</h2>
      <ul className="mt-4 space-y-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {contributions.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: "var(--color-primary)" }}>•</span>
            {c}
          </li>
        ))}
      </ul>
    </section>
    </MainLayout>
  );
}

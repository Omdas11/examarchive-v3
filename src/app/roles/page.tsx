import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Roles, XP & Streaks | ExamArchive",
  description:
    "How ExamArchive roles, XP points, tiers, and daily streaks work — from Student to Founder.",
  alternates: { canonical: "/roles" },
};

const ROLES = [
  {
    name: "Student",
    level: "Level 0",
    color: "#64748b",
    how: "Default for every new account.",
    can: "Browse, download, upload papers for review, use AI tools.",
  },
  {
    name: "Contributor",
    level: "Level 1",
    color: "#3b82f6",
    how: "Automatic — 2 approved uploads + 30 XP + account older than 3 days.",
    can: "Everything a Student can, plus a blue avatar ring.",
  },
  {
    name: "Specialist",
    level: "Level 2",
    color: "#6366f1",
    how: "Automatic — 10 approved uploads + 150 XP.",
    can: "Trusted uploader badge with an indigo avatar ring.",
  },
  {
    name: "Subject Administrator",
    level: "Level 3",
    color: "#0ea5e9",
    how: "Granted by a moderator or founder — never automatic.",
    can: "Approve/reject uploads and edit metadata for assigned subjects.",
  },
  {
    name: "Moderator",
    level: "Level 4",
    color: "#f97316",
    how: "Granted by the founder.",
    can: "Full moderation: manage users, roles, and content.",
  },
  {
    name: "Founder",
    level: "Level 5",
    color: "#ef4444",
    how: "Site owner.",
    can: "Everything, including danger-zone and dev tools.",
  },
];

const XP_RULES = [
  { action: "Approved paper upload", xp: "+50 XP" },
  { action: "First-ever approved upload (one-time)", xp: "+20 XP" },
  { action: "Reaching a 7-day streak", xp: "+100 XP" },
  { action: "Reaching a 30-day streak", xp: "+500 XP" },
];

const TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

export default async function RolesPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Roles & XP"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Roles, XP & Streaks" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Community
        </p>
        <h1 className="mt-2 text-3xl font-black text-on-surface break-words">
          Roles, XP &amp; Streaks
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant leading-relaxed">
          Upload papers, keep a daily streak, and climb from Student to Specialist
          automatically. Moderation roles are granted by humans, never by bots.
        </p>

        {/* Role ladder */}
        <h2 className="mt-10 text-xl font-extrabold text-on-surface">The role ladder</h2>
        <div className="mt-4 space-y-3">
          {ROLES.map((r) => (
            <div
              key={r.name}
              className="rounded-2xl border border-outline-variant/30 bg-surface p-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: r.color }}
                  aria-hidden="true"
                />
                <h3 className="font-bold text-on-surface">{r.name}</h3>
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {r.level}
                </span>
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">How to get it:</span> {r.how}
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                <span className="font-semibold text-on-surface">Can:</span> {r.can}
              </p>
            </div>
          ))}
        </div>

        {/* XP */}
        <h2 className="mt-10 text-xl font-extrabold text-on-surface">Earning XP</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          XP comes only from approved contributions — it never decays.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-outline-variant/30">
          {XP_RULES.map((row, i) => (
            <div
              key={row.action}
              className={`flex items-center justify-between px-4 py-3 text-sm ${
                i % 2 === 0 ? "bg-surface" : "bg-surface-container-low"
              }`}
            >
              <span className="text-on-surface">{row.action}</span>
              <span className="font-bold text-primary">{row.xp}</span>
            </div>
          ))}
        </div>

        {/* Streaks */}
        <h2 className="mt-10 text-xl font-extrabold text-on-surface">Daily streaks</h2>
        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
          Visit on consecutive days to grow your streak. Miss two days and it
          resets to 1. Your avatar ring shows your streak when your role has no
          ring colour — blue for 1–6 days, green for 7–29, and an animated
          four-colour ring at 30+ days.
        </p>

        {/* Tiers */}
        <h2 className="mt-10 text-xl font-extrabold text-on-surface">Tiers</h2>
        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
          Tiers are a separate cosmetic ladder shown on your profile. Reach 20
          approved uploads to move from Bronze to Silver.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-container px-4 py-1.5 text-xs font-bold text-on-surface"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="mt-10 text-xs text-on-surface-variant">
          Full technical reference: <span className="font-mono">docs/ROLES.md</span> in the
          repository.
        </p>
      </section>
    </MainLayout>
  );
}

import type { Metadata } from "next";
import Script from "next/script";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import SupportForm from "./SupportForm";
import {
  DOMAIN_COST_PAISE,
  DOMAIN_COST_RUPEES,
  DOMAIN_RENEWAL_DATE,
  formatRupees,
} from "@/lib/support";

export const metadata: Metadata = {
  title: "Maintenance Costs — Keep ExamArchive Alive",
  description:
    "ExamArchive runs on free infrastructure — the only bill is the domain. Support the domain renewal and keep the archive free for every student.",
};

/** Costs, exactly as they stand. No padding, no rounding games. */
const COSTS = [
  {
    item: "Domain — examarchive.dev",
    detail: `Renews ${DOMAIN_RENEWAL_DATE}`,
    amountPaise: DOMAIN_COST_PAISE,
    icon: "domain",
    color: "#b45309",
    tint: "#f59e0b",
  },
  {
    item: "Hosting — Cloudflare Workers",
    detail: "Free tier",
    amountPaise: 0,
    icon: "cloud",
    color: "#0369a1",
    tint: "#0284c7",
  },
  {
    item: "Database — Cloudflare D1",
    detail: "Free tier",
    amountPaise: 0,
    icon: "database",
    color: "#047857",
    tint: "#059669",
  },
  {
    item: "Storage — Cloudflare R2",
    detail: "Free tier",
    amountPaise: 0,
    icon: "storage",
    color: "#6d28d9",
    tint: "#7c3aed",
  },
  {
    item: "Question papers & syllabus",
    detail: "Free forever, by design",
    amountPaise: 0,
    icon: "description",
    color: "#be123c",
    tint: "#e11d48",
  },
];

const HERO_CHIPS = [
  { icon: "description", label: "636 papers" },
  { icon: "school", label: "517 syllabi" },
  { icon: "savings", label: "Rs 0 hosting" },
];

export default async function MaintenanceCostPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  // Initial totals straight from D1 (the stats API KV-caches the same query).
  let raisedPaise = 0;
  let donors = 0;
  try {
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT COALESCE(SUM(amount_paise), 0) AS raised, COUNT(*) AS donors FROM donations WHERE status = 'paid'",
      )
      .first<{ raised: number; donors: number }>();
    raisedPaise = Number(row?.raised ?? 0);
    donors = Number(row?.donors ?? 0);
  } catch {
    raisedPaise = 0;
    donors = 0;
  }
  const percent = Math.min(100, Math.round((raisedPaise / DOMAIN_COST_PAISE) * 100));
  const remainingPaise = Math.max(0, DOMAIN_COST_PAISE - raisedPaise);

  return (
    <MainLayout
      title="Maintenance Costs"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Maintenance Costs" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        {/* ── Hero: animated gradient ── */}
        <div
          className="mc-hero mc-anim-up relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8"
        >
          <div className="mc-blob h-32 w-32 bg-emerald-300" style={{ top: "-2rem", right: "10%" }} />
          <div
            className="mc-blob h-24 w-24 bg-sky-300"
            style={{ bottom: "-1.5rem", left: "55%", animationDelay: "1.4s" }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
              <span className="mc-live-dot inline-block h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
              Only the domain bills us — everything else is free
            </span>
            <h1 className="mt-4 text-white" style={{ margin: "1rem 0 0" }}>
              Keep ExamArchive Alive
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85">
              ExamArchive is free for every student, and it stays free. This pool
              pays exactly one bill — the domain name. Even Rs 20 counts.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {HERO_CHIPS.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {chip.icon}
                  </span>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Progress ── */}
        <div
          className="mc-anim-up relative z-10 -mt-4 rounded-3xl border p-5 shadow-lg sm:p-6"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface)",
            animationDelay: "0.08s",
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-3xl font-black">
              <span className="mc-gradient-text">{formatRupees(raisedPaise)}</span>
              <span className="text-base font-semibold" style={{ color: "var(--color-text-muted)" }}>
                {" "}/ {formatRupees(DOMAIN_COST_PAISE)}
              </span>
            </span>
            <span
              className="rounded-full px-3 py-1 text-sm font-black text-white"
              style={{ background: "linear-gradient(90deg,#047857,#0284c7)" }}
            >
              {percent}%
            </span>
          </div>
          <div
            className="relative mt-4 h-4 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-surface-muted)" }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="mc-progress-fill h-full rounded-full"
              style={{
                width: `${percent}%`,
                background: "linear-gradient(90deg,#059669,#047857 45%,#0284c7)",
              }}
            />
            <div className="mc-progress-shine" aria-hidden="true" />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <span className="material-symbols-outlined text-base" style={{ color: "#047857" }} aria-hidden="true">
              groups
            </span>
            {donors === 0
              ? "No support yet — be the first."
              : `${donors} supporter${donors === 1 ? "" : "s"} so far.`}
            <span aria-hidden="true">·</span>
            <span className="font-semibold" style={{ color: "var(--color-text)" }}>
              {formatRupees(remainingPaise)} to go
            </span>
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Goal: the examarchive.dev renewal, Rs {DOMAIN_COST_RUPEES.toLocaleString("en-IN")},
            due {DOMAIN_RENEWAL_DATE}. Anything raised past the goal rolls into
            next year&apos;s renewal.
          </p>
        </div>

        {/* ── Cost breakdown ── */}
        <h2 className="mc-anim-up mt-10 flex items-center gap-2 text-lg font-bold" style={{ animationDelay: "0.16s" }}>
          <span className="material-symbols-outlined" style={{ color: "#047857" }} aria-hidden="true">
            receipt_long
          </span>
          Where the money goes
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COSTS.map((c, i) => (
            <div
              key={c.item}
              className="mc-anim-up mc-cost-card flex items-center gap-3 rounded-2xl border p-4"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                animationDelay: `${0.2 + i * 0.06}s`,
              }}
            >
              <span
                className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl"
                style={{
                  color: c.color,
                  background: `color-mix(in srgb, ${c.tint} 14%, var(--color-surface))`,
                }}
                aria-hidden="true"
              >
                {c.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{c.item}</span>
                <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {c.detail}
                </span>
              </span>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-sm font-black"
                style={
                  c.amountPaise === 0
                    ? { color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }
                    : { color: "#b45309", background: "color-mix(in srgb, #f59e0b 14%, var(--color-surface))" }
                }
              >
                {c.amountPaise === 0 ? "Rs 0" : formatRupees(c.amountPaise)}
              </span>
            </div>
          ))}
          <div
            className="mc-anim-up mc-cost-card flex items-center gap-3 rounded-2xl border-2 border-dashed p-4"
            style={{ borderColor: "var(--color-border)", animationDelay: "0.5s" }}
          >
            <span
              className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl"
              style={{ color: "#047857", background: "var(--color-accent-soft)" }}
              aria-hidden="true"
            >
              volunteer_activism
            </span>
            <span className="text-sm leading-snug" style={{ color: "var(--color-text-muted)" }}>
              <span className="block font-bold" style={{ color: "var(--color-text)" }}>
                100% goes to the domain
              </span>
              No fees taken by ExamArchive. Razorpay charges its small payment fee.
            </span>
          </div>
        </div>

        {/* ── Support form ── */}
        <h2 className="mc-anim-up mt-10 flex items-center gap-2 text-lg font-bold" style={{ animationDelay: "0.24s" }}>
          <span className="material-symbols-outlined" style={{ color: "#e11d48" }} aria-hidden="true">
            favorite
          </span>
          Support the pool
        </h2>
        <SupportForm
          initialRaisedPaise={raisedPaise}
          initialDonors={donors}
          defaultName={user?.name ?? ""}
        />

        <p
          className="mt-6 flex items-start gap-2 text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            lock
          </span>
          Payments are processed securely by Razorpay. Support is a one-time
          donation toward the domain renewal — it is not a purchase and buys no
          credits or passes. If the goal is already met, your support still
          helps next year&apos;s renewal.
        </p>
      </section>
    </MainLayout>
  );
}

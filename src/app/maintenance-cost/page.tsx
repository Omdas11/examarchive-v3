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
  },
  { item: "Hosting — Cloudflare Workers", detail: "Free tier", amountPaise: 0 },
  { item: "Database — Cloudflare D1", detail: "Free tier", amountPaise: 0 },
  { item: "Storage — Cloudflare R2", detail: "Free tier", amountPaise: 0 },
  { item: "Question papers & syllabus", detail: "Free forever, by design", amountPaise: 0 },
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
        <h1 className="text-2xl font-bold">Keep ExamArchive Alive</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          ExamArchive is free for every student, and it stays free. The site runs
          on free infrastructure — the only bill is the domain name. This pool
          pays exactly that bill. Even ₹20 counts.
        </p>

        {/* ── Progress ── */}
        <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-2xl font-black">
              {formatRupees(raisedPaise)}
              <span className="text-base font-semibold" style={{ color: "var(--color-text-muted)" }}>
                {" "}/ {formatRupees(DOMAIN_COST_PAISE)}
              </span>
            </span>
            <span className="text-sm font-bold">{percent}%</span>
          </div>
          <div
            className="mt-3 h-3 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-surface-muted)" }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${percent}%`, background: "#047857" }}
            />
          </div>
          <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {donors === 0
              ? "No support yet — be the first."
              : `${donors} supporter${donors === 1 ? "" : "s"} so far.`}{" "}
            Goal: the examarchive.dev renewal, ₹{DOMAIN_COST_RUPEES.toLocaleString("en-IN")},
            due {DOMAIN_RENEWAL_DATE}. Anything raised past the goal rolls into
            next year&apos;s renewal.
          </p>
        </div>

        {/* ── Cost breakdown ── */}
        <h2 className="mt-8 text-lg font-bold">Where the money goes</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--color-border)" }}>
          {COSTS.map((c) => (
            <div
              key={c.item}
              className="flex items-baseline justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0"
              style={{ borderColor: "var(--color-border)" }}
            >
              <span>
                <span className="font-semibold">{c.item}</span>
                <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {c.detail}
                </span>
              </span>
              <span className="font-bold whitespace-nowrap">
                {c.amountPaise === 0 ? "₹0" : formatRupees(c.amountPaise)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Support form ── */}
        <h2 className="mt-8 text-lg font-bold">Support the pool</h2>
        <SupportForm
          initialRaisedPaise={raisedPaise}
          initialDonors={donors}
          defaultName={user?.name ?? ""}
        />

        <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Payments are processed securely by Razorpay. Support is a one-time
          donation toward the domain renewal — it is not a purchase and buys no
          credits or passes. If the goal is already met, your support still
          helps next year&apos;s renewal.
        </p>
      </section>
    </MainLayout>
  );
}

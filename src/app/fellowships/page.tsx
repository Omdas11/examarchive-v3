import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import FellowshipsClient from "./FellowshipsClient";
import { FELLOWSHIPS } from "@/data/fellowships";

export const metadata: Metadata = {
  title: "Fellowships & Scholarships — ExamArchive",
  description:
    "National research fellowships (UGC NET JRF, CSIR NET JRF, DBT JRF, ICMR JRF, INSPIRE, PMRF), PhD admissions at IISc, TIFR, IISERs and Assam University, and scholarships for undergraduates (INSPIRE SHE, Ishan Uday, NSP) — with official apply links and deadlines.",
  alternates: { canonical: "/fellowships" },
};

export default async function FellowshipsPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Fellowships"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Fellowships" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 style={{ margin: "0 0 0.5rem" }}>Fellowships &amp; Scholarships</h1>
        <p className="mt-0 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Research fellowships and PhD admissions from across India, and
          scholarships for undergraduate students — each with the official
          apply link. Every link goes to the government or institute site
          itself, never a third party.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              workspace_premium
            </span>
            {FELLOWSHIPS.length} fellowships &amp; scholarships
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              school
            </span>
            {FELLOWSHIPS.filter((f) => f.section === "research").length} research
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
            style={{ color: "#0369a1", background: "color-mix(in srgb, #0284c7 12%, var(--color-surface))" }}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              verified
            </span>
            {FELLOWSHIPS.filter((f) => f.section === "scholarship").length} scholarships
          </span>
        </div>

        <div className="mt-6">
          <FellowshipsClient />
        </div>
      </section>
    </MainLayout>
  );
}

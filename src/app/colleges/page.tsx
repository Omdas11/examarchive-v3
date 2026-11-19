import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { COLLEGES } from "@/lib/colleges";

export const metadata: Metadata = {
  title: "Colleges under Assam University — ExamArchive",
  description:
    "All 75 colleges affiliated to Assam University, Silchar — with their locations and official websites. Question papers from every college, covering soon.",
  alternates: { canonical: "/colleges" },
};

const DISTRICTS = [
  "Cachar",
  "Karimganj",
  "Hailakandi",
  "Dima Hasao",
  "Karbi Anglong",
  "West Karbi Anglong",
];

export default async function CollegesPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const withWebsite = COLLEGES.filter((c) => c.website).length;

  return (
    <MainLayout
      title="Colleges"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Colleges" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 style={{ margin: "0 0 0.5rem" }}>Colleges under Assam University</h1>
        <p className="mt-0 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Every college affiliated to Assam University, Silchar — across
          Cachar, Karimganj, Hailakandi, Dima Hasao, Karbi Anglong and West
          Karbi Anglong. One university, one exam system, one set of question
          papers — and we are bringing them all here.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">domain</span>
            {COLLEGES.length} colleges
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "#0369a1", background: "color-mix(in srgb, #0284c7 12%, var(--color-surface))" }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">map</span>
            {DISTRICTS.length} districts
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "#6d28d9", background: "color-mix(in srgb, #7c3aed 12%, var(--color-surface))" }}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">language</span>
            {withWebsite} official websites
          </span>
        </div>

        <div
          className="mt-6 flex items-start gap-3 rounded-2xl border p-4"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <span className="material-symbols-outlined shrink-0" style={{ color: "#b45309" }} aria-hidden="true">
            schedule
          </span>
          <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            <span className="font-bold" style={{ color: "var(--color-text)" }}>Covering soon.</span>{" "}
            Papers from Haflong Government College are already live. Papers
            from the other {COLLEGES.length - 1} colleges are being collected —
            starting with the subjects those colleges teach that Haflong
            doesn&apos;t, like Geography, Anthropology and Statistics. If your
            college&apos;s papers are missing,{" "}
            <a href="/browse" className="font-semibold underline">request them from the Browse page</a>{" "}
            or <a href="/submit-paper" className="font-semibold underline">submit a paper</a>.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COLLEGES.map((college) => (
            <article
              key={college.name}
              className="flex flex-col gap-2 rounded-2xl border p-4"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 text-base font-bold leading-snug">{college.name}</h2>
                {college.covered ? (
                  <a
                    href="/browse"
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black text-white"
                    style={{ background: "#047857" }}
                  >
                    Papers available
                  </a>
                ) : (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black"
                    style={{ color: "#92400e", background: "color-mix(in srgb, #f59e0b 16%, var(--color-surface))" }}
                  >
                    Covering soon
                  </span>
                )}
              </div>
              <p className="m-0 flex items-center gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  location_on
                </span>
                {college.location}
              </p>
              {college.website ? (
                <a
                  href={college.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: "#047857" }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    language
                  </span>
                  Official website
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    open_in_new
                  </span>
                </a>
              ) : (
                <p className="m-0 mt-auto text-xs" style={{ color: "var(--color-text-muted)" }}>
                  No official website found
                </p>
              )}
            </article>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          College list: official Assam University affiliated-college list
          (aus.ac.in). Locations: university College Development Council list.
          Website links verified November 2026; 8 colleges have no official
          website we could find. Spotted a wrong link? Tell us on the{" "}
          <a href="/contact" className="font-semibold underline">contact page</a>.
        </p>
      </section>
    </MainLayout>
  );
}

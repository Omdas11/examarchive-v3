import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import {
  STUDY_RESOURCES,
  STUDY_RESOURCE_CATEGORIES,
} from "@/data/study-resources";

export const metadata: Metadata = {
  title: "Study Resources — Official Links for HGC FYUGP Students",
  description:
    "Curated official study links for Haflong Government College FYUGP students: college & university portals, FYUGP syllabi, NCERT e-Pathshala, NPTEL, SWAYAM and e-PG Pathshala.",
  keywords: [
    "study resources",
    "Haflong Government College",
    "Assam University FYUGP",
    "NPTEL",
    "SWAYAM",
    "e-Pathshala",
    "e-PG Pathshala",
  ],
  alternates: { canonical: "/study-resources" },
  openGraph: {
    title: "Study Resources | ExamArchive",
    description:
      "Official links every HGC FYUGP student should bookmark — college, university, syllabi and free national study platforms.",
    url: "https://examarchive.dev/study-resources",
    type: "website",
  },
};

export default async function StudyResourcesPage() {
  const user = await getServerUser();
  const userName = user ? user.name || user.username || "Scholar" : "Guest";
  const userInitials = user ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Study Resources"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Study Resources" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-6 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-[2rem] bg-surface p-8 shadow-lift border border-outline-variant/10 relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-5 rounded-full -mr-10 -mt-10 blur-2xl" />
          <h1 className="text-3xl font-black text-on-surface tracking-tight relative z-10">
            Study Resources
          </h1>
          <p className="mt-3 max-w-2xl text-base font-medium text-on-surface-variant/80 relative z-10">
            Official links every Haflong Government College FYUGP student should
            bookmark — the college and university portals, FYUGP syllabi, and
            free national study platforms.
          </p>
        </div>

        {STUDY_RESOURCE_CATEGORIES.map((category) => {
          const items = STUDY_RESOURCES.filter((r) => r.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-8 rounded-full bg-primary" />
                <h2 className="text-xl font-extrabold tracking-tight">{category}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.map((resource) => (
                  <a
                    key={resource.url + resource.title}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-3xl border border-outline-variant/20 bg-surface p-6 shadow-lift transition-all duration-200 hover:-translate-y-1 hover:shadow-ambient"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                        {resource.title}
                      </h3>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className="shrink-0 mt-1 text-on-surface-variant opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all"
                      >
                        <path d="M7 17L17 7M7 7h10v10" />
                      </svg>
                    </div>
                    <p className="mt-2 text-sm font-medium text-on-surface-variant leading-relaxed">
                      {resource.description}
                    </p>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-primary/70 truncate">
                      {new URL(resource.url).hostname}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-center text-xs font-medium text-on-surface-variant/60">
          Spot a broken link or know an official resource we missed? Email{" "}
          <a
            href="mailto:feedback@examarchive.dev"
            className="font-bold text-primary hover:underline"
          >
            feedback@examarchive.dev
          </a>
          .
        </p>
      </section>
    </MainLayout>
  );
}

import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";
import { GUIDES, MORE_GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Study Guides",
  description:
    "Original study guides for Assam University FYUG students: how to use previous year papers, and subject-wise preparation for Physics, Chemistry, Mathematics, English, History, Political Science, Economics, and Bengali.",
};

const ALL = [...GUIDES, ...MORE_GUIDES];

export default async function GuidesPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  return (
    <MainLayout
      title="Study Guides"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Study Guides" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Study Guides</h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Original guides written for ExamArchive students. They do not replace your syllabus or
        textbooks. Use them with the previous year papers in the archive: read a guide, then
        attempt a paper on that subject, then come back and fix what the paper exposed.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ALL.map((g) => (
          <Link
            key={g.slug}
            href={`/guides/${g.slug}`}
            className="rounded-3xl border border-outline-variant/10 bg-surface p-6 hover:shadow-lg transition-shadow"
          >
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
              {g.department}
            </p>
            <h2 className="mt-2 text-base font-bold leading-snug">{g.title}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {g.excerpt}
            </p>
          </Link>
        ))}
      </div>
    </section>
    </MainLayout>
  );
}

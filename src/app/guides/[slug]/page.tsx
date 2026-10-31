import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, MORE_GUIDES } from "@/lib/guides";

const ALL = [...GUIDES, ...MORE_GUIDES];

export function generateStaticParams() {
  return ALL.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = ALL.find((g) => g.slug === slug);
  if (!guide) return { title: "Guide Not Found" };
  return {
    title: guide.title,
    description: guide.excerpt,
    alternates: { canonical: `/guides/${slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = ALL.find((g) => g.slug === slug);
  if (!guide) notFound();
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  return (
    <MainLayout
      title={guide.title}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Study Guides", href: "/guides" }, { label: guide.title }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <Link href="/guides" className="text-sm font-bold underline" style={{ color: "var(--color-primary)" }}>
        ← All study guides
      </Link>
      <p className="mt-6 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>
        {guide.department} · Original ExamArchive guide
      </p>
      <h1 className="mt-2 text-2xl font-bold leading-tight">{guide.title}</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {guide.excerpt}
      </p>
      <div className="mt-8 space-y-8">
        {guide.sections.map((s) => (
          <div key={s.heading}>
            <h2 className="text-lg font-bold">{s.heading}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-3xl border border-outline-variant/10 bg-surface p-6">
        <h2 className="text-base font-bold">Now try it</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Pick a previous year paper in this subject from the archive, attempt it timed, and
          mark it with the method in the guide above. That attempt, not re-reading this guide,
          is what turns advice into marks.
        </p>
        <Link href="/browse" className="mt-4 inline-block font-bold underline" style={{ color: "var(--color-primary)" }}>
          Browse papers →
        </Link>
      </div>
    </section>
    </MainLayout>
  );
}

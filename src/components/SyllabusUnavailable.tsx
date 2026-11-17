import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

/**
 * Temporary syllabus-disabled page. Rendered (inside MainLayout, so the
 * header/navigation still show) by every /syllabus* page while
 * SYLLABUS_DISABLED is true. Shows no syllabus data — no paper lists,
 * no unit content, no download buttons. Middleware sets the HTTP status
 * to 503 so search engines retry later instead of deindexing.
 *
 * To re-enable the syllabus, set SYLLABUS_DISABLED = false in
 * src/lib/site-flags.ts.
 */
export default function SyllabusUnavailable() {
  return (
    <MainLayout
      title="Syllabus Temporarily Unavailable"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Syllabus" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="student"
      isLoggedIn={false}
      userName=""
      userInitials=""
    >
      <section className="mx-auto w-full px-4 pb-16 pt-8" style={{ maxWidth: "var(--max-w)" }}>
        <div className="rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Syllabus Library
          </p>
          <h1 className="mt-2 text-2xl font-black text-on-surface sm:text-3xl">
            Syllabus is temporarily unavailable
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            We are verifying all syllabus content. Please check back later.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Question papers, notes and the rest of the site are still available.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              Back to home
            </Link>
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/40 px-4 py-2 text-sm font-semibold text-on-surface"
            >
              Browse question papers
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}

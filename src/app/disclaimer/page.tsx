import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Disclaimer for ExamArchive — where the papers come from and what the site does and does not promise.",
};

export default async function DisclaimerPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  return (
    <MainLayout
      title="Disclaimer"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Disclaimer" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Disclaimer</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Last updated: November 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>1. Where the Papers Come From</h2>
          <p className="mt-2">
            Many PDFs in the archive come from different sources. The question papers are
            examination papers originally set by Assam University. Some were collected from
            other archives and study sites, including LearnFo and E-learning Info, and some
            were contributed directly by students. Where the source of a paper is known, it
            is credited on the paper page.
          </p>
          <p className="mt-2">
            185 papers in the archive have no recorded source. We are working to identify
            their sources, and they will be credited once known.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>2. Ownership</h2>
          <p className="mt-2">
            ExamArchive does not claim ownership of the question papers, and it does not claim
            that it owns the copyright in them. Papers are shared for study only, to help
            students prepare for their examinations. Study guides and other articles written
            for ExamArchive are original content of ExamArchive.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>3. Accuracy</h2>
          <p className="mt-2">
            Accuracy is not guaranteed. Papers, syllabi, and study guides may contain errors,
            missing pages, or outdated content. Always check the official syllabus and notices
            from your college and university before relying on any material here.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>4. Takedown Requests</h2>
          <p className="mt-2">
            If you are a rights holder and want a paper removed, contact us at{" "}
            <a href="mailto:contact@examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              contact@examarchive.dev
            </a>{" "}
            with the paper title, course code, and year, and the reason for the request. Papers
            are removed on a valid takedown request.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>5. No Affiliation</h2>
          <p className="mt-2">
            ExamArchive is run by students and is not affiliated with, endorsed by, or operated
            by Assam University or Haflong Government College. See our{" "}
            <Link href="/terms" style={{ color: "var(--color-primary)" }} className="underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" style={{ color: "var(--color-primary)" }} className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
    </MainLayout>
  );
}

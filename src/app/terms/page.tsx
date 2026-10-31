import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms and conditions for using ExamArchive.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Last updated: October 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing and using ExamArchive, you accept and agree to be bound by the terms and
            provisions of this agreement. If you do not agree, please do not use the site.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>2. What ExamArchive Is</h2>
          <p className="mt-2">
            ExamArchive is a free, community-driven archive for students of Haflong Government
            College, Assam University. It hosts previous-year question papers, syllabi, and
            original study guides, and it is run by students, not by Assam University or Haflong
            Government College. The site is not affiliated with, endorsed by, or operated by
            either institution.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>3. Use of Content</h2>
          <p className="mt-2">
            All content on ExamArchive is provided for personal educational purposes only, to help
            students prepare for their examinations. Users may download and use papers for
            personal study. Redistribution for commercial purposes, resale, or republication
            without permission is prohibited.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>4. Question Papers and Copyright</h2>
          <p className="mt-2">
            Question papers in the archive are examination papers originally set by Assam
            University and shared by students for study purposes. ExamArchive does not claim
            ownership of those papers, and it does not claim that it owns the copyright in them.
            Papers are published after admin review for authenticity, and they are removed on a
            valid takedown request from the rights holder. To request removal, contact us at{" "}
            <a href="mailto:contact@examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              contact@examarchive.dev
            </a>{" "}
            with the paper title, course code, and year, and the reason for the request.
          </p>
          <p className="mt-2">
            Study guides, explanations, and other articles written for ExamArchive are original
            content of ExamArchive and may not be copied or republished without permission.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>5. User Contributions</h2>
          <p className="mt-2">
            By uploading content, you confirm that you have the right to share it, that it is not
            copied from a source that forbids sharing, and that you grant ExamArchive a
            non-exclusive license to host and distribute it for educational purposes. Uploads
            that are abusive, misleading, or infringing may be removed, and accounts that
            repeatedly upload such content may be blocked.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>6. Accounts and Fair Use</h2>
          <p className="mt-2">
            You are responsible for keeping your account secure. You must not attempt to bypass
            download limits, scrape the archive in bulk, impersonate another user, or interfere
            with the site&apos;s operation. We may suspend accounts that abuse the service.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>7. Advertising</h2>
          <p className="mt-2">
            ExamArchive may show advertising, including Google AdSense, only after you accept
            cookies in the cookie banner. Advertising does not mean ExamArchive endorses the
            advertised products or services. You can change your cookie choice at any time from
            the Cookie Settings link in the footer. See our{" "}
            <Link href="/privacy" style={{ color: "var(--color-primary)" }} className="underline">
              Privacy Policy
            </Link>{" "}
            for how advertising cookies work.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>8. Disclaimer</h2>
          <p className="mt-2">
            ExamArchive is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
            the accuracy, completeness, or reliability of any content, including papers,
            syllabi, and study guides. Always check the official syllabus and notices from
            your college and university before relying on any material here.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>9. Changes to These Terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. Significant changes will be shown by
            updating the &quot;Last updated&quot; date at the top of this page.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>10. Contact</h2>
          <p className="mt-2">
            If you have questions about these terms, or a takedown request, please contact us at{" "}
            <a href="mailto:contact@examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              contact@examarchive.dev
            </a>{" "}
            or visit our{" "}
            <Link href="/contact" style={{ color: "var(--color-primary)" }} className="underline">
              contact page
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

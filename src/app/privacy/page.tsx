import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for ExamArchive — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Last updated: March 2026
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>1. Introduction</h2>
          <p className="mt-2">
            ExamArchive (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your privacy. This
            Privacy Policy explains how we collect, use, disclose, and safeguard your information
            when you visit ExamArchive at{" "}
            <a href="https://examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              examarchive.dev
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>2. Information We Collect</h2>
          <p className="mt-2">We may collect the following types of information:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Account information:</strong> When you register, we collect your email address,
              display name, and username.
            </li>
            <li>
              <strong>Profile data:</strong> Avatar image, role, XP, streak, and upload history.
            </li>
            <li>
              <strong>Uploaded content:</strong> Exam papers and syllabi you submit, along with
              associated metadata (course, year, institution).
            </li>
            <li>
              <strong>Usage data:</strong> Pages visited, search queries, paper views and downloads
              (aggregated and anonymised).
            </li>
            <li>
              <strong>Technical data:</strong> IP address, browser type, and device information
              collected automatically via server logs and analytics services.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>3. How We Use Your Information</h2>
          <p className="mt-2">We use collected information to:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Provide and maintain the ExamArchive service.</li>
            <li>Process and moderate uploaded exam papers and syllabi.</li>
            <li>Manage your account, role, XP, and streak.</li>
            <li>Send service-related emails (magic-link sign-in, upload approval notifications).</li>
            <li>Improve the platform through aggregated usage analytics.</li>
            <li>Prevent abuse, fraud, and violations of our Terms &amp; Conditions.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>4. Cookies and Local Storage</h2>
          <p className="mt-2">
            ExamArchive uses a secure HTTP-only session cookie to keep you signed in. We also use
            browser <code>localStorage</code> to remember your theme preference (light/dark). No
            third-party advertising cookies are used.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>5. Third-Party Services</h2>
          <p className="mt-2">We use the following third-party services:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Appwrite</strong> — backend-as-a-service for authentication, database, and
              file storage.
            </li>
            <li>
              <strong>Vercel</strong> — hosting and edge network; processes request logs.
            </li>
            <li>
              <strong>Vercel Analytics &amp; Speed Insights</strong> — privacy-friendly, cookieless
              performance analytics.
            </li>
            <li>
              <strong>Google OAuth</strong> (optional) — if you choose to sign in with Google, your
              Google account email is shared with us.
            </li>
          </ul>
          <p className="mt-2">
            Each third-party service operates under its own privacy policy.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>6. Data Retention</h2>
          <p className="mt-2">
            Your account data is retained as long as your account remains active. Uploaded papers
            remain on the platform indefinitely unless removed by an admin or at your request.
            Activity logs are retained for up to 12 months for moderation purposes.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>7. Your Rights</h2>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Access a copy of the personal data we hold about you.</li>
            <li>Correct inaccurate personal data via the Settings page.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Object to the processing of your data for analytics purposes.</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{" "}
            <a href="mailto:privacy@examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              privacy@examarchive.dev
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>8. Security</h2>
          <p className="mt-2">
            We implement appropriate technical and organisational measures to protect your data.
            Session tokens are stored in secure, HTTP-only cookies. Passwords are never stored —
            authentication is handled via magic-link email or Google OAuth.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>9. Children&apos;s Privacy</h2>
          <p className="mt-2">
            ExamArchive is intended for university students and is not directed at children under the
            age of 13. We do not knowingly collect personal data from children.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>10. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. We will notify users of significant
            changes by updating the &quot;Last updated&quot; date at the top of this page.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>11. Contact</h2>
          <p className="mt-2">
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:privacy@examarchive.dev" style={{ color: "var(--color-primary)" }} className="underline">
              privacy@examarchive.dev
            </a>{" "}
            or visit our{" "}
            <Link href="/support" style={{ color: "var(--color-primary)" }} className="underline">
              support page
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

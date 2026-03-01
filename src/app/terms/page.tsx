import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms and conditions for using ExamArchive.",
};

export default function TermsPage() {
  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      <h1 className="text-2xl font-bold">Terms of Use</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Last updated: {new Date().getFullYear()}
      </p>

      <div className="mt-6 space-y-6 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing and using ExamArchive, you accept and agree to be bound by the terms and
            provisions of this agreement.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>2. Use of Content</h2>
          <p className="mt-2">
            All content on ExamArchive is provided for educational purposes only. Users may download
            and use papers for personal study. Redistribution for commercial purposes is prohibited.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>3. User Contributions</h2>
          <p className="mt-2">
            By uploading content, you confirm that you have the right to share it and grant
            ExamArchive a non-exclusive license to host and distribute it.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>4. Disclaimer</h2>
          <p className="mt-2">
            ExamArchive is provided &quot;as is&quot; without warranties of any kind. We do not guarantee the
            accuracy, completeness, or reliability of any content.
          </p>
        </div>

        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>5. Contact</h2>
          <p className="mt-2">
            If you have questions about these terms, please contact us at{" "}
            <a href="mailto:contact@examarchive.org" style={{ color: "var(--color-primary)" }} className="underline">
              contact@examarchive.org
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
}

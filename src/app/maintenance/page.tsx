import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Under Maintenance",
  description:
    "ExamArchive is under maintenance while we move to a faster home. Leave your email and we will tell you the moment we are back.",
  robots: { index: false, follow: false },
};

// Google Form collecting emails to notify when the site is back.
// Form: "ExamArchive - Notify Me When We Are Back"
// Responses: https://docs.google.com/forms/d/e/1FAIpQLSfbJ-tXE45DGi29ZnoHXZIrNQJDuR8-aRt1SyJ9ELeUVXZISw/viewform
const FORM_EMBED_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfbJ-tXE45DGi29ZnoHXZIrNQJDuR8-aRt1SyJ9ELeUVXZISw/viewform?embedded=true";

/**
 * Maintenance page. Fully static: no Appwrite calls, no getServerUser, so
 * it renders even while Appwrite reads are exhausted. Shown for every route
 * while MAINTENANCE_MODE is true in src/lib/site-flags.ts (middleware
 * rewrites to here with HTTP 503). Set the flag to false to bring the
 * site back.
 */
export default function MaintenancePage() {
  return (
    <main
      className="mx-auto flex min-h-screen flex-col items-center px-4 py-12 text-center"
      style={{ maxWidth: "var(--max-w)" }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl font-extrabold text-white"
        style={{ backgroundColor: "#047857" }}
        aria-hidden="true"
      >
        E
      </div>

      <h1 className="mt-6 text-3xl font-extrabold" style={{ color: "var(--color-text)" }}>
        ExamArchive is under maintenance
      </h1>

      <p
        className="mt-3 max-w-xl text-base leading-relaxed"
        style={{ color: "var(--color-text-muted)" }}
      >
        We are moving the archive to a faster home so it can handle everyone
        coming to study. The papers will be back very soon. Thank you for
        your patience.
      </p>

      <div className="mt-8 w-full max-w-xl rounded-2xl border p-4 text-left sm:p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          Get notified when we are back
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Leave your email below. We will send you one email the moment the
          site is back, so you can sign up again. No spam, just the one
          message.
        </p>
        <iframe
          src={FORM_EMBED_URL}
          title="Notify me when ExamArchive is back"
          className="mt-4 w-full rounded-xl border-0"
          style={{ minHeight: 420 }}
          loading="lazy"
        >
          Loading the signup form…
        </iframe>
      </div>

      <p className="mt-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Questions? Write to{" "}
        <a
          href="mailto:contact@examarchive.dev"
          className="font-semibold underline"
          style={{ color: "var(--color-text)" }}
        >
          contact@examarchive.dev
        </a>
      </p>
    </main>
  );
}

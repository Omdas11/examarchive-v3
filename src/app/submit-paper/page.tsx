import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Submit a Question Paper",
  description:
    "Send us a missing Assam University question paper — fill in the paper details and upload the PDF. One paper per submission.",
  alternates: { canonical: "/submit-paper" },
};

/** Short share link for the paper-collection Google Form. */
const FORM_SHORT_URL = "https://forms.gle/kDnGMqF7L4ic9oho8";
/** Embed URL for the same form (iframe). */
const FORM_EMBED_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSf6XjqLHvcDAufmROTF2efqxYowPwPDdhnF4OT0N9VT-hNRwQ/viewform?embedded=true";

const SCAN_STEPS = [
  "Install Adobe Scan from the Play Store — it's free. Sign in with your Google account. (If it shows a Premium trial, tap “Not Now” — scanning to PDF is free.)",
  "Tap the camera, hold your phone over the paper. The app finds the page edges by itself — tap to capture each page.",
  "When all pages are done, tap the page thumbnail, then tap Save PDF.",
  "To get the PDF on your phone: open the saved file, tap the three dots, then Copy to device.",
  "Come back here and upload that PDF in the form below.",
];

export default async function SubmitPaperPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  return (
    <MainLayout
      title="Submit a Paper"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Submit a Paper" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">Submit a Question Paper</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Have a question paper we are missing? Fill in the paper details and upload the PDF —
          one paper per submission. Our team reviews every submission before it is added to the
          archive. Google asks you to sign in to a Google account to upload a file; that is
          Google&apos;s requirement, not ours.
        </p>

        <div className="mt-8 rounded-3xl border border-outline-variant/10 bg-surface p-6 shadow-lift">
          <h2 className="text-lg font-bold">Only have the paper copy? Make a free PDF with Adobe Scan</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {SCAN_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Tip: scan in good light with the paper flat, and check every page is clear before saving.
          </p>
        </div>

        <div className="mt-8">
          <iframe
            src={FORM_EMBED_URL}
            title="Submit a Question Paper - ExamArchive"
            width="100%"
            height="1600"
            frameBorder="0"
            loading="lazy"
            className="w-full rounded-3xl border border-outline-variant/10 bg-surface shadow-lift"
          >
            Loading…
          </iframe>
          <p className="mt-3 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            Form not loading?{" "}
            <a
              href={FORM_SHORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline"
            >
              Open the form in a new tab
            </a>
            .
          </p>
        </div>
      </section>
    </MainLayout>
  );
}

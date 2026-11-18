import type { Metadata } from "next";
import Image from "next/image";
import SubscribeForm from "./SubscribeForm";

export const metadata: Metadata = {
  title: "Under Maintenance",
  description:
    "ExamArchive is under maintenance while we move to a faster home. Leave your email and we will tell you the moment we are back.",
  robots: { index: false, follow: false },
};

/**
 * Maintenance page. Fully static: no Appwrite calls, no getServerUser, so
 * it renders even while Appwrite reads are exhausted. Shown for every route
 * while MAINTENANCE_MODE is true in src/lib/site-flags.ts (middleware
 * rewrites to here with HTTP 503). Set the flag to false to bring the
 * site back. Email signup is collected in Supabase (table
 * maintenance_subscribers) via SubscribeForm.
 */
export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <Image
          src="/branding/logo.png"
          alt="ExamArchive"
          width={96}
          height={96}
          className="mx-auto h-24 w-24 rounded-3xl shadow-lg"
          priority
        />

        <p
          className="mt-5 text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: "#047857" }}
        >
          ExamArchive
        </p>

        <h1
          className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl"
          style={{ color: "var(--color-text)" }}
        >
          We&rsquo;ll be back soon
        </h1>

        <p
          className="mx-auto mt-3 max-w-sm text-base leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          We are moving the archive to a faster home so it can handle
          everyone coming to study. The papers will be back very soon.
          Thank you for your patience.
        </p>

        <SubscribeForm />

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
      </div>
    </main>
  );
}

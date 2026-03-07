import type { Metadata } from "next";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about ExamArchive and how it works.",
};

/** SVG icons for each workflow step */
const STEP_ICONS = [
  // Upload – arrow pointing up from tray
  <svg key="upload" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>,
  // Review – clipboard with checkmark
  <svg key="review" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>,
  // Publish – globe / broadcast
  <svg key="publish" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>,
  // Discover – magnifying glass over document
  <svg key="discover" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>,
];

const steps = [
  { icon: STEP_ICONS[0], title: "Upload", desc: "Students upload past question papers and notes." },
  { icon: STEP_ICONS[1], title: "Review", desc: "Admins review and verify each submission." },
  { icon: STEP_ICONS[2], title: "Publish", desc: "Approved papers are published to the archive." },
  { icon: STEP_ICONS[3], title: "Discover", desc: "Anyone can browse and download freely." },
];

const contributions = [
  "Upload question papers you have access to.",
  "Report incorrect or duplicate papers.",
  "Share the platform with fellow students.",
  "Provide feedback to help us improve.",
  "Apply to become a moderator or admin.",
];

/** Fetch live platform statistics from Appwrite. Falls back to 0 on error. */
async function fetchStats() {
  try {
    const db = adminDatabases();
    const [papersRes, syllabusRes, usersRes] = await Promise.allSettled([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
        Query.equal("approval_status", "approved"),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.users, [Query.limit(1)]),
    ]);

    const papers =
      papersRes.status === "fulfilled" ? papersRes.value.total : 0;
    const syllabi =
      syllabusRes.status === "fulfilled" ? syllabusRes.value.total : 0;
    const users =
      usersRes.status === "fulfilled" ? usersRes.value.total : 0;

    return { papers, syllabi, users };
  } catch {
    return { papers: 0, syllabi: 0, users: 0 };
  }
}

export default async function AboutPage() {
  const { papers, syllabi, users } = await fetchStats();

  const stats = [
    { label: "Published Papers", value: papers > 0 ? `${papers}+` : "0+" },
    { label: "Contributors", value: users > 0 ? `${users}+` : "0+" },
    { label: "Syllabi Available", value: syllabi > 0 ? `${syllabi}+` : "0+" },
    { label: "Free & Open", value: "100%" },
  ];

  return (
    <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
      {/* Intro */}
      <h1 className="text-2xl font-bold">About ExamArchive</h1>
      <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
        <p>
          ExamArchive is a community-driven platform that collects and organizes past exam question
          papers, syllabi, and academic resources for students.
        </p>
        <p>
          Our goal is to make exam preparation easier by providing free and open access to question
          papers from various universities, programmes, and streams.
        </p>
      </div>

      {/* How It Works */}
      <h2 className="mt-10 text-xl font-semibold">How It Works</h2>
      <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-0 sm:gap-0">
        {steps.map((s, idx) => (
          <div key={s.title} className="flex flex-col sm:flex-row items-center flex-1 min-w-0">
            {/* Step card */}
            <div className="card p-5 text-center flex-1 w-full sm:min-w-0">
              <span
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
              >
                {s.icon}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.desc}</p>
            </div>
            {/* Arrow connector between steps */}
            {idx < steps.length - 1 && (
              <>
                {/* Horizontal arrow on sm+ screens */}
                <svg
                  className="hidden sm:block shrink-0 mx-1"
                  width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "var(--color-primary)", opacity: 0.5 }}
                >
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
                {/* Vertical arrow on mobile */}
                <svg
                  className="block sm:hidden my-1"
                  width="24" height="24" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ color: "var(--color-primary)", opacity: 0.5 }}
                >
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <polyline points="5 12 12 19 19 12"/>
                </svg>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Platform Stats */}
      <h2 className="mt-10 text-xl font-semibold">Platform Stats</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* How to Contribute */}
      <h2 className="mt-10 text-xl font-semibold">How to Contribute</h2>
      <ul className="mt-4 space-y-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
        {contributions.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: "var(--color-primary)" }}>•</span>
            {c}
          </li>
        ))}
      </ul>
    </section>
  );
}

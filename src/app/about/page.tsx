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

const steps = [
  { num: 1, title: "Upload", desc: "Students upload past question papers and notes." },
  { num: 2, title: "Review", desc: "Admins review and verify each submission." },
  { num: 3, title: "Publish", desc: "Approved papers are published to the archive." },
  { num: 4, title: "Discover", desc: "Anyone can browse and download freely." },
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.num} className="card p-5 text-center">
            <span
              className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "var(--color-primary)" }}
            >
              {s.num}
            </span>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{s.desc}</p>
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

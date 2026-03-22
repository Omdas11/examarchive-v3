import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import HomeSearch from "@/components/HomeSearch";
import PaperCard from "@/components/PaperCard";
import AnimatedCounter from "@/components/AnimatedCounter";
import DevProgressBar from "@/components/DevProgressBar";
import VisitorTracker from "@/components/VisitorTracker";
import FireParticles from "@/components/FireParticles";
import BottomNav from "@/components/BottomNav";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import {
  adminDatabases,
  adminUsers,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { toPaper } from "@/types";
import type { Paper } from "@/types";

export const metadata: Metadata = {
  title: "ExamArchive – Free Past Exam Papers & Syllabi · Early Access",
  description:
    "Sign up to view free past exam question papers and syllabi. Starting with Haflong Government College — community archive for students, verified by our team.",
  keywords: [
    "ExamArchive",
    "exam papers",
    "past papers",
    "question papers",
    "notes",
    "syllabus",
    "exam",
    "Haflong Government College",
    "Assam University",
    "Gauhati University",
    "free exam papers",
    "FYUGP",
    "CBCS",
    "NEP",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "ExamArchive – Free Past Exam Papers & Syllabi · Early Access",
    description:
      "Sign up to view free past exam papers and syllabi. Starting with Haflong Government College — community-driven, verified archive.",
    url: "https://examarchive.dev",
    type: "website",
  },
};

/** Shape of a single user-submitted feedback entry from the `feedback` collection. */
interface FeedbackEntry {
  id: string;
  name: string;
  university: string;
  text: string;
}

/** Returns `count unit` with a simple plural suffix (papers/syllabi/students). */
function pluralCount(count: number, singular: string, plural: string): string {
  return `${count > 0 ? count.toLocaleString() : "0"} ${count === 1 ? singular : plural}`;
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload",
    desc: "Students upload past exam papers or syllabi directly from the site. No account required for browsing.",
    colorClass: "bg-primary",
  },
  {
    step: "2",
    title: "Admin Verification",
    desc: "Our team reviews each submission for quality and authenticity before publishing.",
    colorClass: "bg-amber-400",
  },
  {
    step: "3",
    title: "Student Access",
    desc: "Verified papers go live instantly. Students can browse metadata freely and view PDFs after signing in.",
    colorClass: "bg-emerald-600",
  },
];

export default async function HomePage() {
  const user = await getServerUser();

  // ── Fetch statistics ──────────────────────────────────────────────────────
  let papersTotal = 0;
  let syllabusTotal = 0;
  let usersTotal = 0;
  let launchProgress = 40;
  const universitiesSet = new Set<string>();

  // ── Fetch popular & recent papers ─────────────────────────────────────────
  let popularPapers: Paper[] = [];
  let recentPapers: Paper[] = [];

  // ── Fetch real feedback/testimonials ──────────────────────────────────────
  let feedbackEntries: FeedbackEntry[] = [];

  try {
    const db = adminDatabases();

    const [papersRes, syllabusRes] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.papers, [
        Query.equal("approved", true),
        Query.limit(100),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
        Query.equal("approval_status", "approved"),
        Query.limit(1),
      ]),
    ]);

    papersTotal = papersRes.total;
    syllabusTotal = syllabusRes.total;

    // Collect distinct universities
    for (const doc of papersRes.documents) {
      if (doc.institution) universitiesSet.add(doc.institution as string);
    }

    // Popular papers: highest view_count
    const allPapers = papersRes.documents.map(toPaper);
    popularPapers = [...allPapers]
      .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
      .slice(0, 4);

    // Recently added papers: newest first
    recentPapers = [...allPapers]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4);
  } catch {
    // collections may not exist yet in dev
  }

  try {
    const { total } = await adminUsers().list([]);
    usersTotal = total;
  } catch {
    // may not have permission in dev
  }

  // Fetch site metrics (launch_progress)
  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.site_metrics, "singleton");
    launchProgress = (doc.launch_progress as number) ?? 40;
  } catch {
    // collection may not exist yet
  }

  // Fetch approved feedback entries (max 3 for homepage)
  try {
    const db = adminDatabases();
    const feedbackRes = await db.listDocuments(DATABASE_ID, COLLECTION.feedback, [
      Query.equal("approved", true),
      Query.limit(3),
    ]);
    feedbackEntries = feedbackRes.documents.map((doc) => ({
      id: doc.$id as string,
      name: (doc.name as string) ?? "Anonymous",
      university: (doc.university as string) ?? "",
      text: (doc.text as string) ?? "",
    }));
  } catch {
    // feedback collection may not exist yet
  }

  const stats: { label: string; value: number; icon: React.ReactNode }[] = [
    {
      label: "Question Papers",
      value: papersTotal,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      label: "Syllabi",
      value: syllabusTotal,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
    },
    {
      label: "Universities",
      value: universitiesSet.size,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
        </svg>
      ),
    },
    {
      label: "Students",
      value: usersTotal,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
  ];

  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Home"
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
      showSearch={false}
      hideHeaderOnMobile
      hideFooterOnMobile
    >
      {/* Fire particle effect — fixed bottom-to-midpoint, behind content */}
      <div className="hidden md:block">
        <FireParticles />
      </div>

      <div className="mx-auto px-4 relative" style={{ maxWidth: "var(--max-w)", zIndex: 1 }}>
        {/* ── Mobile Material 3 expressive composition ── */}
        <section className="md:hidden -mx-4 min-h-screen px-5 pb-32 pt-5" style={{ background: "var(--color-bg)" }}>
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "color-mix(in srgb, var(--color-border) 55%, transparent)" }}>
            <div className="inline-flex items-center gap-2 text-lg font-extrabold" style={{ color: "var(--color-primary)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              ExamArchive
            </div>
            <button type="button" aria-label="Search library" className="rounded-full p-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <section className="pt-8">
            <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight">
              Explore the <span style={{ color: "var(--color-primary)" }}>Archive</span>
            </h1>
            <p className="m3-mobile-hero-subtitle mt-4 leading-tight" style={{ color: "var(--color-text-muted)" }}>
              Access over 50,000 verified exam papers and study resources from top universities worldwide.
            </p>
          </section>

          <section className="mt-8">
            <HomeSearch variant="expressive" />
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Universities</h2>
            <div className="mt-4 space-y-2 text-2xl">
              <div className="rounded-2xl px-4 py-3 font-bold" style={{ color: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, white)" }}>
                <div className="flex items-center justify-between">
                  <span>Stanford</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--color-primary) 16%, white)", color: "var(--color-primary)" }}>1.2k</span>
                </div>
              </div>
              <div className="px-4 py-2">MIT</div>
              <div className="px-4 py-2">Oxford</div>
              <div className="px-4 py-2">Harvard</div>
              <Link href="/browse" className="inline-flex items-center gap-1 px-4 pt-1 font-semibold" style={{ color: "var(--color-primary)" }}>
                View all
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Academic year</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {["2024", "2023", "2022", "2021"].map((y) => (
                <button
                  key={y}
                  type="button"
                  className="rounded-full border px-5 py-1.5 text-lg"
                  style={y === "2023"
                    ? { background: "var(--color-primary)", color: "var(--m3-on-primary)", borderColor: "var(--color-primary)" }
                    : { borderColor: "var(--color-border)" }}
                >
                  {y}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-3xl font-extrabold leading-none">Featured Resources</h2>
              <button type="button" className="text-base" style={{ color: "var(--color-text-muted)" }}>Sort by: <span className="font-semibold" style={{ color: "var(--color-text)" }}>Newest</span></button>
            </div>

            <div className="space-y-4">
              <article className="card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, white)", color: "var(--color-primary)" }}>✣</div>
                  <span className="rounded-full px-3 py-1 text-xs font-bold tracking-[0.08em]" style={{ background: "var(--m3-mobile-verified-badge-bg)", color: "var(--m3-mobile-verified-badge-text)" }}>VERIFIED</span>
                </div>
                <h3 className="text-4xl font-extrabold leading-tight">Advanced Quantum Mechanics</h3>
                <p className="m3-mobile-card-body mt-2 leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  Midterm examination papers covering Schrödinger’s equation and angular momentum.
                </p>
              </article>

              <article className="card p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "#ffe1be", color: "#8c5a16" }}>✎</div>
                  <span className="rounded-full px-3 py-1 text-xs font-bold tracking-[0.08em]" style={{ background: "color-mix(in srgb, var(--color-primary) 18%, white)", color: "#374151" }}>SOLUTION KEY</span>
                </div>
                <h3 className="text-4xl font-extrabold leading-tight">European History 1848-1914</h3>
                <p className="m3-mobile-card-body mt-2 leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  Detailed essay outlines and grading rubrics for final thesis preparation.
                </p>
              </article>

              <article className="card p-5">
                <div className="mb-4 h-11 w-11 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--color-primary) 8%, white)", color: "var(--color-primary)" }}>‹›</div>
                <h3 className="text-4xl font-extrabold leading-tight">Distributed Systems</h3>
                <p className="m3-mobile-card-body mt-2 leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  Project guidelines and past exam questions focusing on consensus algorithms and Paxos.
                </p>
              </article>
            </div>
          </section>

          <section className="mt-8 rounded-[2rem] px-6 py-8 text-center text-white" style={{ background: "linear-gradient(160deg, #5647ea 0%, #2f2caf 100%)" }}>
            <div className="text-2xl">✦</div>
            <h2 className="mt-2 text-4xl font-extrabold">Can&apos;t find it?</h2>
            <p className="mt-2 text-xl text-white">Generate a custom mock exam based on your syllabus in seconds.</p>
            <Link href="/ai-content" className="mt-5 inline-flex rounded-full bg-white px-6 py-2 text-base font-extrabold tracking-[0.08em]" style={{ color: "var(--m3-mobile-generator-button-text)" }}>
              TRY GENERATOR
            </Link>
          </section>

          <Link
            href="/upload"
            aria-label="Upload paper"
            className="fixed bottom-24 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full text-3xl text-white shadow-lg"
            style={{ background: "var(--color-primary)" }}
          >
            +
          </Link>

          <BottomNav variant="expressive" />
        </section>

        {/* ── Development progress banner ── */}
        <div className="hidden md:block pt-16 md:pt-6">
          <DevProgressBar progress={launchProgress} />
        </div>

        {/* ── Hero ── */}
        <section className="hidden md:block py-14 text-center rounded-2xl relative overflow-hidden">
          {/* Subtle decorative blobs that complement the full-site gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-10"
            style={{ background: "var(--color-primary)", filter: "blur(60px)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-16 w-64 h-64 rounded-full opacity-10"
            style={{ background: "var(--nav-teal)", filter: "blur(60px)" }}
          />

          <div className="relative z-10 px-4">
            {/* Early Access badge */}
            <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
              <div
                className="inline-block rounded-full px-4 py-1 text-xs font-semibold"
                style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
              >
                Free &amp; Community-Driven Archive
              </div>
              <div
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wide"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                  letterSpacing: "0.08em",
                }}
              >
                {/* Star SVG */}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Early Access
              </div>
            </div>

            {/* Shiny heading */}
            <h1
              className="ea-hero-heading text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl mx-auto max-w-2xl leading-tight"
            >
              ExamArchive —{" "}
              <span style={{ color: "var(--color-primary)" }}>Past Papers &amp; Syllabi</span>
              {" "}for{" "}
              <span style={{ color: "var(--success-green)" }}>Free.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: "var(--color-text-muted)" }}>
              <strong>Sign up to view past exam papers, syllabi, and other free resources.</strong>
              {" "}Contributed by students, verified by our team.
              Starting with{" "}
              <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Haflong Government College</span>.
            </p>

            {/* Visitor tracker (records visit silently, shows running count) */}
            <div className="mt-2 flex justify-center">
              <VisitorTracker />
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/browse" className="btn-primary text-base px-6 py-2.5">
                Browse Question Papers
              </Link>
              <Link href="/upload" className="btn text-base px-6 py-2.5">
                Upload Paper
              </Link>
              {!user && (
                <Link href="/login" className="btn text-base px-6 py-2.5">
                  Sign In
                </Link>
              )}
              {user && (
                <Link href="/profile" className="btn text-base px-6 py-2.5">
                  My Profile
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Transparency Statement ── */}
        <section className="hidden md:block py-5">
          <div
            className="card p-4 text-center"
            style={{
              borderLeft: "4px solid var(--color-primary)",
              background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))",
            }}
          >
            <p className="text-sm font-semibold flex items-center justify-center gap-1.5 flex-wrap" style={{ color: "var(--color-text)" }}>
              {/* Chart SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span style={{ color: "var(--color-primary)" }}>Transparency: </span>
              Currently the archive contains{" "}
              <strong>{pluralCount(papersTotal, "paper", "papers")}</strong>,
              the registry lists{" "}
              <strong>{pluralCount(syllabusTotal, "syllabus", "syllabi")}</strong>,
              and{" "}
              <strong>{pluralCount(usersTotal, "student", "students")}</strong>
              {" "}are active.
            </p>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="hidden md:block py-4 mb-2 ea-scroll-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="card p-4 text-center"
                style={{
                  background: "color-mix(in srgb, var(--color-surface) 55%, transparent)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  border: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
                }}
              >
                <div
                  className="flex justify-center mb-1"
                  style={{ color: "var(--color-primary)" }}
                >
                  {s.icon}
                </div>
                <div className="text-2xl font-extrabold" style={{ color: "var(--color-primary)" }}>
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Search ── */}
        <section className="hidden md:block py-6">
          <h2 className="mb-3 text-lg font-semibold">Search Exam Papers &amp; Syllabi</h2>
          <HomeSearch />
        </section>

        {/* ── Popular Papers ── */}
        {popularPapers.length > 0 && (
          <section className="hidden md:block py-6 ea-scroll-in">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Popular Papers</h2>
              <Link
                href="/browse"
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {popularPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently Added Papers ── */}
        {recentPapers.length > 0 && (
          <section className="hidden md:block py-6 ea-scroll-in">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Recently Added</h2>
              <Link
                href="/browse"
                className="text-xs font-medium hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                View all →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {recentPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </section>
        )}

        {/* ── How It Works ── */}
        <section className="hidden md:block py-8 ea-scroll-in">
          <h2 className="mb-6 text-lg font-semibold text-center">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="card p-5 text-center">
                <div
                  className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-lg font-extrabold text-white ${step.colorClass}`}
                >
                  {step.step}
                </div>
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Community Contribution ── */}
        <section className="hidden md:block py-6 ea-scroll-in">
          <div
            className="card p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))" }}
          >
            {/* Graduation cap SVG */}
            <div className="shrink-0" aria-hidden="true" style={{ color: "var(--color-primary)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h2 className="text-base font-bold mb-1">Have Old Question Papers?</h2>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Help your fellow students! Upload your past exam papers and syllabi.
                Every contribution goes through admin verification before going live.
              </p>
            </div>
            <Link href="/upload" className="btn-primary shrink-0 whitespace-nowrap">
              Contribute Now
            </Link>
          </div>
        </section>

        {/* ── Student Feedback ── */}
        <section className="hidden md:block py-6 ea-scroll-in">
          <h2 className="mb-4 text-lg font-semibold text-center">What Students Say</h2>
          {feedbackEntries.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {feedbackEntries.map((t) => (
                <div key={t.id} className="card p-5">
                  <p
                    className="text-sm leading-relaxed mb-4"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: "var(--color-primary)" }}
                      aria-hidden="true"
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{t.name}</p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t.university}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>
                No reviews yet — be the first to share your experience!
              </p>
              <a
                href="mailto:feedback@examarchive.dev"
                className="btn text-xs px-4 py-1.5"
              >
                Send Feedback
              </a>
            </div>
          )}
        </section>

      </div>
    </MainLayout>
  );
}

import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getServerUser } from "@/lib/auth";
import HomeSearch from "@/components/HomeSearch";
import PaperCard from "@/components/PaperCard";
import AnimatedCounter from "@/components/AnimatedCounter";
import DevProgressBar from "@/components/DevProgressBar";
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
    "NEP",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "ExamArchive – Free Past Exam Papers & Syllabi · Early Access",
    description:
      "Sign up to view free past exam papers and syllabi. Starting with Haflong Government College — community-driven, verified archive.",
    url: "https://www.examarchive.dev",
    siteName: "ExamArchive",
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
    colorClass: "bg-primary shadow-lg shadow-primary/20",
  },
  {
    step: "2",
    title: "Admin Verification",
    desc: "Our team reviews each submission for quality and authenticity before publishing.",
    colorClass: "bg-tertiary shadow-lg shadow-tertiary/20",
  },
  {
    step: "3",
    title: "Student Access",
    desc: "Verified papers go live instantly. Students can browse metadata freely and view PDFs after signing in.",
    colorClass: "bg-secondary shadow-lg shadow-secondary/20",
  },
];

/** Cached homepage data — revalidates every hour to avoid hitting Appwrite on every request. */
const getHomepageData = unstable_cache(
  async () => {
    let papersTotal = 0;
    let syllabusTotal = 0;
    let usersTotal = 0;
    let launchProgress = 40;
    let universitiesCount = 0;
    let popularPapers: Paper[] = [];
    let recentPapers: Paper[] = [];
    let feedbackEntries: FeedbackEntry[] = [];

    try {
      const db = adminDatabases();

      const pageSize = 100;
      const [papersRes, syllabusRes] = await Promise.all([
        db.listDocuments(DATABASE_ID, COLLECTION.papers, [
          Query.equal("approved", true),
          Query.limit(pageSize),
        ]),
        db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [
          Query.equal("approval_status", "approved"),
          Query.limit(1),
        ]),
      ]);

      papersTotal = papersRes.total;
      syllabusTotal = syllabusRes.total;

      const universitiesSet = new Set<string>();
      const allPapers: Paper[] = [];
      const addInstitutions = (papers: Paper[]) => {
        for (const paper of papers) {
          const institution = paper.institution?.trim();
          if (institution) universitiesSet.add(institution);
        }
      };

      const firstPagePapers = papersRes.documents.map(toPaper);
      allPapers.push(...firstPagePapers);
      addInstitutions(firstPagePapers);

      const firstPageCount = papersRes.documents.length;
      if (papersTotal > firstPageCount && firstPageCount > 0) {
        let offset = firstPageCount;
        while (offset < papersTotal) {
          const pageRes = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
            Query.equal("approved", true),
            Query.limit(pageSize),
            Query.offset(offset),
          ]);
          if (pageRes.documents.length === 0) break;
          const pagePapers = pageRes.documents.map(toPaper);
          allPapers.push(...pagePapers);
          addInstitutions(pagePapers);
          offset += pageRes.documents.length;
        }
      }

      // Popular papers: highest view_count
      popularPapers = [...allPapers]
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, 4);

      // Recently added papers: newest first
      recentPapers = [...allPapers]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4);

      universitiesCount = universitiesSet.size;
    } catch {
      // collections may not exist yet in dev
    }

    try {
      const db = adminDatabases();
      // Use the users collection so service accounts aren't included in the public metric.
      const { total } = await db.listDocuments(DATABASE_ID, COLLECTION.users, [Query.limit(1)]);
      usersTotal = total;
    } catch {
      try {
        const { total } = await adminUsers().list([]);
        usersTotal = total;
      } catch {
        // may not have permission in dev
      }
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

    return {
      papersTotal,
      syllabusTotal,
      usersTotal,
      launchProgress,
      universitiesCount,
      popularPapers,
      recentPapers,
      feedbackEntries,
    };
  },
  ["homepage-data"],
  { revalidate: 3600 },
);

export default async function HomePage() {
  const user = await getServerUser();

  const {
    papersTotal,
    syllabusTotal,
    usersTotal,
    launchProgress,
    universitiesCount,
    popularPapers,
    recentPapers,
    feedbackEntries,
  } = await getHomepageData();

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
      value: universitiesCount,
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
      >
      <div className="mx-auto px-6 relative" style={{ maxWidth: "var(--max-w)", zIndex: 1 }}>

        {/* ── Development progress banner ── */}
        <div className="pt-16 md:pt-6">
          <DevProgressBar progress={launchProgress} />
        </div>

        {/* ── Hero ── */}
        <section className="py-20 text-center rounded-[2.5rem] relative overflow-hidden mt-6 bg-surface shadow-ambient border border-outline-variant/5">
          {/* Subtle decorative blobs that complement the full-site gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-[0.03]"
            style={{ background: "var(--color-primary)", filter: "blur(80px)" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full opacity-[0.03]"
            style={{ background: "var(--brand-blue)", filter: "blur(80px)" }}
          />

          <div className="relative z-10 px-6">
            {/* Early Access badge */}
            <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
              <div
                className="inline-block rounded-full px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest"
                style={{ background: "var(--brand-emerald-soft)", color: "var(--brand-emerald-dark)" }}
              >
                Free &amp; Community-Driven
              </div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase shadow-sm"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                }}
              >
                <span className="material-symbols-outlined text-sm font-bold">star</span>
                Early Access
              </div>
            </div>

            {/* Academic Vitality heading */}
            <h1
              className="ea-hero-heading text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mx-auto max-w-4xl leading-[1.1]"
            >
              Academic Intelligence —{" "}
              <span className="text-primary">Past Papers &amp; Syllabi</span>
              {" "}for{" "}
              <span className="text-secondary">Everyone.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl font-medium" style={{ color: "var(--color-text-muted)" }}>
              Access a verified repository of academic resources.
              Contributed by students, optimized by AI.
              Starting with{" "}
              <span className="text-primary font-bold">Haflong Government College</span>.
            </p>

            <div className="mt-12 flex flex-wrap justify-center gap-4">
              <Link href="/browse" className="btn-primary text-base px-10 py-4 rounded-full shadow-lg hover:shadow-floating transition-all active:scale-95">
                Explore Archive
              </Link>
              <Link href="/upload" className="bg-surface text-on-surface border border-outline-variant/20 font-bold text-base px-10 py-4 rounded-full shadow-sm hover:bg-surface-container-low transition-all active:scale-95">
                Upload Paper
              </Link>
              {!user ? (
                <Link href="/login" className="bg-surface-container-low text-primary font-bold text-base px-10 py-4 rounded-full hover:bg-surface-container transition-all active:scale-95">
                  Sign In
                </Link>
              ) : (
                <Link href="/profile" className="bg-surface-container-low text-primary font-bold text-base px-10 py-4 rounded-full hover:bg-surface-container transition-all active:scale-95">
                  My Profile
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Transparency Statement ── */}
        <section className="py-8">
          <div
            className="rounded-full p-4 text-center border border-primary/10 shadow-sm"
            style={{
              background: "var(--brand-emerald-soft)",
            }}
          >
            <p className="text-sm font-bold flex items-center justify-center gap-2 flex-wrap min-h-[1.5rem]" style={{ color: "var(--brand-emerald-dark)" }}>
              <span className="material-symbols-outlined text-lg font-bold">analytics</span>
              <span className="uppercase tracking-widest text-xs opacity-70">Archive Status: </span>
              <strong>{pluralCount(papersTotal, "paper", "papers")}</strong>
              {" "}·{" "}
              <strong>{pluralCount(syllabusTotal, "syllabus", "syllabi")}</strong>
              {" "}·{" "}
              <strong>{pluralCount(usersTotal, "student", "students")}</strong>
              {" "}online.
            </p>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="py-6 mb-4 ea-scroll-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="bg-surface p-6 text-center rounded-3xl border border-outline-variant/10 shadow-lift group hover:shadow-ambient hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className="flex justify-center mb-3 text-primary group-hover:scale-110 transition-transform"
                >
                  {s.icon}
                </div>
                <div className="text-3xl font-extrabold tracking-tighter text-on-surface">
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest mt-2 text-on-surface-variant/70">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Search ── */}
        <section className="py-10">
          <div className="flex flex-col items-center text-center mb-8">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Search the Archive</h2>
            <p className="text-on-surface-variant font-medium text-sm">Find papers, syllabi, and notes by subject or code</p>
          </div>
          <HomeSearch />
        </section>

        {/* ── Popular Papers ── */}
        {popularPapers.length > 0 && (
          <section className="py-10 ea-scroll-in">
            <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-8 rounded-full bg-primary" />
                <h2 className="text-xl font-extrabold tracking-tight">Popular Resources</h2>
              </div>
              <Link
                href="/browse"
                className="text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full bg-primary-fixed text-primary hover:bg-primary hover:text-on-primary transition-all"
              >
                View all Resources
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {popularPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently Added Papers ── */}
        {recentPapers.length > 0 && (
          <section className="py-10 ea-scroll-in">
            <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2 h-8 rounded-full bg-secondary" />
                <h2 className="text-xl font-extrabold tracking-tight">Recently Added</h2>
              </div>
              <Link
                href="/browse"
                className="text-xs font-bold uppercase tracking-widest py-2 px-4 rounded-full bg-secondary-container text-secondary hover:bg-secondary hover:text-on-secondary transition-all"
              >
                Browse Recent
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {recentPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          </section>
        )}

        {/* ── How It Works ── */}
        <section className="py-16 ea-scroll-in">
          <h2 className="mb-12 text-2xl font-extrabold tracking-tight text-center">How It Works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="bg-surface p-8 text-center rounded-[2rem] border border-outline-variant/10 shadow-lift hover:shadow-ambient transition-all">
                <div
                  className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-white ${step.colorClass}`}
                >
                  {step.step}
                </div>
                <h3 className="font-extrabold text-lg mb-2 tracking-tight">{step.title}</h3>
                <p className="text-sm leading-relaxed text-on-surface-variant font-medium">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Community Contribution ── */}
        <section className="py-10 ea-scroll-in">
          <div
            className="p-10 sm:p-14 flex flex-col sm:flex-row items-center gap-8 rounded-[3rem] shadow-floating border border-primary/10 relative overflow-hidden"
            style={{ background: "var(--brand-emerald-soft)" }}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-5 rounded-full -mr-20 -mt-20 blur-3xl" />
            
            {/* Graduation cap SVG */}
            <div className="shrink-0 w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-lift text-primary" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left relative z-10">
              <h2 className="text-2xl font-extrabold mb-2 tracking-tight">Start Uploading Question Papers</h2>
              <p className="text-base font-medium text-on-surface-variant">
                Help your fellow students by submitting past exam papers and syllabi.
                Every contribution builds the community repository.
              </p>
            </div>
            <Link href="/upload" className="btn-primary text-base px-10 py-4 rounded-full shadow-lg hover:shadow-floating transition-all active:scale-95 shrink-0 whitespace-nowrap">
              Contribute Now
            </Link>
          </div>
        </section>

        {/* ── Student Feedback ── */}
        <section className="py-16 ea-scroll-in">
          <h2 className="mb-10 text-2xl font-extrabold tracking-tight text-center">Student Voices</h2>
          {feedbackEntries.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-3">
              {feedbackEntries.map((t) => (
                <div key={t.id} className="bg-surface p-8 rounded-[2rem] border border-outline-variant/10 shadow-lift flex flex-col h-full hover:shadow-ambient transition-all">
                  <div className="mb-6 text-primary flex">
                    <span className="material-symbols-outlined font-black">format_quote</span>
                  </div>
                  <p
                    className="text-sm font-medium leading-relaxed mb-8 flex-1 italic text-on-surface/80"
                  >
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-4">
                    <div
                      className="h-12 w-12 rounded-2xl flex items-center justify-center text-lg font-black text-on-primary shrink-0 shadow-sm"
                      style={{ background: "var(--color-primary)" }}
                      aria-hidden="true"
                    >
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-on-surface truncate">{t.name}</p>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/60 truncate">{t.university}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface p-10 text-center rounded-3xl border border-outline-variant/10 shadow-lift max-w-xl mx-auto">
              <p className="text-on-surface-variant font-medium mb-6">
                No reviews yet — be the first to share your experience!
              </p>
              <a
                href="mailto:feedback@examarchive.dev"
                className="bg-surface-container-low text-primary font-bold text-sm px-8 py-3 rounded-full hover:bg-surface-container transition-all inline-block"
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

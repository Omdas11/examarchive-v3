import type { Metadata } from "next";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import HomeSearch from "@/components/HomeSearch";
import PaperCard from "@/components/PaperCard";
import AnimatedCounter from "@/components/AnimatedCounter";
import DevProgressBar from "@/components/DevProgressBar";
import VisitorTracker from "@/components/VisitorTracker";
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
    "Sign up to view free past exam question papers and syllabi for Assam University. Starting with Assam University — community archive for students, verified by our team.",
  keywords: [
    "ExamArchive",
    "exam papers",
    "past papers",
    "question papers",
    "notes",
    "syllabus",
    "exam",
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
      "Sign up to view free past exam papers and syllabi for Assam University. Community-driven, verified archive.",
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

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Upload",
    desc: "Students upload past exam papers or syllabi directly from the site. No account required for browsing.",
    color: "var(--color-primary)",
  },
  {
    step: "2",
    title: "Admin Verification",
    desc: "Our team reviews each submission for quality and authenticity before publishing.",
    color: "var(--pending-amber)",
  },
  {
    step: "3",
    title: "Student Access",
    desc: "Verified papers go live instantly. Students can browse metadata freely and view PDFs after signing in.",
    color: "var(--success-green)",
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

  const stats = [
    { label: "Question Papers", value: papersTotal, icon: "📄" },
    { label: "Syllabi", value: syllabusTotal, icon: "📚" },
    { label: "Universities", value: universitiesSet.size, icon: "🏛️" },
    { label: "Students", value: usersTotal, icon: "👥" },
  ];

  return (
    <div className="mx-auto px-4" style={{ maxWidth: "var(--max-w)" }}>

      {/* ── Development progress banner ── */}
      <div className="pt-6">
        <DevProgressBar progress={launchProgress} />
      </div>

      {/* ── Hero ── */}
      <section
        className="py-14 text-center rounded-2xl relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)) 0%, color-mix(in srgb, var(--nav-teal) 6%, var(--color-surface)) 100%)",
        }}
      >
        {/* Subtle decorative blobs */}
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
              className="inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wide"
              style={{
                background: "var(--color-primary)",
                color: "#fff",
                letterSpacing: "0.08em",
              }}
            >
              ✦ Early Access
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl mx-auto max-w-2xl leading-tight">
            ExamArchive —{" "}
            <span style={{ color: "var(--color-primary)" }}>Past Papers &amp; Syllabi</span>
            {" "}for{" "}
            <span style={{ color: "var(--success-green)" }}>Free.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: "var(--color-text-muted)" }}>
            <strong>Sign up to view PDFs and other free resources.</strong>
            {" "}Contributed by students, verified by our team.
            Starting with{" "}
            <span style={{ color: "var(--color-primary)", fontWeight: 600 }}>Assam University</span>.
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
      <section className="py-5">
        <div
          className="card p-4 text-center"
          style={{
            borderLeft: "4px solid var(--color-primary)",
            background: "color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))",
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
            📊{" "}
            <span style={{ color: "var(--color-primary)" }}>Transparency: </span>
            Currently the archive contains{" "}
            <strong>{papersTotal > 0 ? papersTotal.toLocaleString() : "0"} paper{papersTotal !== 1 ? "s" : ""}</strong>,
            the registry lists{" "}
            <strong>{syllabusTotal > 0 ? syllabusTotal.toLocaleString() : "0"} {syllabusTotal === 1 ? "syllabus" : "syllabi"}</strong>,
            and{" "}
            <strong>{usersTotal > 0 ? usersTotal.toLocaleString() : "0"} student{usersTotal !== 1 ? "s" : ""}</strong>
            {" "}are active.
          </p>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="py-4 mb-2 ea-scroll-in">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="card p-4 text-center"
            >
              <div className="text-2xl mb-1" aria-hidden="true">{s.icon}</div>
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
      <section className="py-6">
        <h2 className="mb-3 text-lg font-semibold">Search Exam Papers &amp; Syllabi</h2>
        <HomeSearch />
      </section>

      {/* ── Popular Papers ── */}
      {popularPapers.length > 0 && (
        <section className="py-6 ea-scroll-in">
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
        <section className="py-6 ea-scroll-in">
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
      <section className="py-8 ea-scroll-in">
        <h2 className="mb-6 text-lg font-semibold text-center">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="card p-5 text-center">
              <div
                className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-lg font-extrabold text-white"
                style={{ background: step.color }}
              >
                {step.step}
              </div>
              <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Community Contribution ── */}
      <section className="py-6 ea-scroll-in">
        <div
          className="card p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 overflow-hidden"
          style={{ background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-surface))" }}
        >
          <div className="text-4xl shrink-0" aria-hidden="true">🎓</div>
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
      <section className="py-6 ea-scroll-in">
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
  );
}

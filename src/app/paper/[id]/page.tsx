import type { Metadata } from "next";
import { createClient } from "@/lib/supabaseServer";
import type { Paper } from "@/types";

interface PaperPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
  const supabase = createClient();
  const { data: paper } = await supabase
    .from("papers")
    .select("title, course_code, course_name")
    .eq("id", params.id)
    .single();

  if (!paper) return { title: "Paper Not Found" };

  return {
    title: `${paper.title} – ${paper.course_code}`,
    description: `Download ${paper.title} for ${paper.course_name} (${paper.course_code}).`,
  };
}

export default async function PaperPage({ params }: PaperPageProps) {
  const supabase = createClient();
  const { data: paper } = await supabase
    .from("papers")
    .select("*")
    .eq("id", params.id)
    .single<Paper>();

  if (!paper) {
    return (
      <section className="mx-auto px-4 py-20 text-center" style={{ maxWidth: "var(--max-w)" }}>
        <h1 className="text-2xl font-bold">Paper Not Found</h1>
        <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>The requested paper does not exist.</p>
      </section>
    );
  }

  const badges = [
    paper.year,
    paper.semester,
    paper.department,
    paper.exam_type,
  ];

  return (
    <section className="mx-auto px-4 py-10 space-y-6" style={{ maxWidth: "var(--max-w)" }}>
      {/* Paper header card */}
      <div className="card p-6">
        <p className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
          {paper.course_code}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{paper.title}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {paper.course_name}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span
              key={b}
              className="inline-block rounded-full px-3 py-0.5 text-xs font-medium"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {b}
            </span>
          ))}
        </div>
        <a
          href={paper.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-5 block w-full text-center"
        >
          Open Latest PDF →
        </a>
      </div>

      {/* Available papers */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Available Papers</h2>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--color-border)" }}>
          <li className="flex items-center justify-between py-2.5 text-sm">
            <span>{paper.year} — {paper.semester} {paper.exam_type}</span>
            <a
              href={paper.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium"
              style={{ color: "var(--color-primary)" }}
            >
              View PDF
            </a>
          </li>
        </ul>
      </div>

      {/* Syllabus */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Syllabus</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Syllabus not available yet.
        </p>
      </div>

      {/* Repeated Questions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Repeated Questions</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Loading repeated questions…
        </p>
      </div>

      {/* Notes & Resources */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Notes &amp; Resources</h2>
        <div className="mt-3 space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: "var(--color-border)" }} />
          <div className="h-4 w-1/2 animate-pulse rounded" style={{ background: "var(--color-border)" }} />
        </div>
      </div>
    </section>
  );
}

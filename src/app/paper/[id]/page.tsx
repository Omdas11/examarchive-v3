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
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Paper Not Found</h1>
        <p className="mt-2 text-gray-500">The requested paper does not exist.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">{paper.title}</h1>
      <p className="mt-1 text-gray-500">
        {paper.course_code} &middot; {paper.course_name}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="font-medium text-gray-400">Department</dt>
          <dd>{paper.department}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Year</dt>
          <dd>{paper.year}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Semester</dt>
          <dd>{paper.semester}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Exam Type</dt>
          <dd>{paper.exam_type}</dd>
        </div>
      </dl>

      <div className="mt-8">
        <a
          href={paper.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Download / View Paper
        </a>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabaseServer";
import PaperCard from "@/components/PaperCard";
import type { Paper } from "@/types";

export const metadata: Metadata = {
  title: "Browse Papers",
  description: "Search and filter past exam papers by department, course, year and more.",
};

interface BrowsePageProps {
  searchParams: {
    department?: string;
    course_code?: string;
    year?: string;
    semester?: string;
    exam_type?: string;
    search?: string;
  };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const supabase = createClient();

  let query = supabase
    .from("papers")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (searchParams.department) query = query.eq("department", searchParams.department);
  if (searchParams.course_code) query = query.eq("course_code", searchParams.course_code);
  if (searchParams.year) query = query.eq("year", Number(searchParams.year));
  if (searchParams.semester) query = query.eq("semester", searchParams.semester);
  if (searchParams.exam_type) query = query.eq("exam_type", searchParams.exam_type);
  if (searchParams.search) query = query.ilike("title", `%${searchParams.search}%`);

  const { data: papers } = await query;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">Browse Papers</h1>
      <p className="mt-1 text-sm text-gray-500">
        Filter results using query parameters (e.g. ?department=CS&amp;year=2024).
      </p>

      {papers && papers.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {papers.map((p: Paper) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-gray-400">No papers found.</p>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import { createClient } from "@/lib/supabaseServer";
import type { Syllabus } from "@/types";

export const metadata: Metadata = {
  title: "Syllabus",
  description: "Browse course syllabi by department.",
};

export default async function SyllabusPage() {
  const supabase = createClient();

  const { data: syllabi } = await supabase
    .from("syllabi")
    .select("*")
    .order("course_code", { ascending: true });

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">Syllabus</h1>
      <p className="mt-1 text-sm text-gray-500">Download syllabi for various courses.</p>

      {syllabi && syllabi.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {syllabi.map((s: Syllabus) => (
            <a
              key={s.id}
              href={s.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <h3 className="font-semibold">{s.course_code}</h3>
              <p className="text-sm text-gray-500">{s.course_name}</p>
              <span className="mt-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                {s.department}
              </span>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-gray-400">No syllabi available.</p>
      )}
    </section>
  );
}

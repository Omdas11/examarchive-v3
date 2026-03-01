import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        Exam<span className="text-blue-600">Archive</span>
      </h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
        Browse, search and download past exam papers. A community-driven archive
        for students.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/browse"
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          Browse Papers
        </Link>
        <Link
          href="/syllabus"
          className="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 transition"
        >
          View Syllabus
        </Link>
      </div>
    </section>
  );
}

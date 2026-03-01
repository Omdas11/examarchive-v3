import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Exam<span className="text-blue-600">Archive</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/browse" className="hover:text-blue-600 transition-colors">
            Browse
          </Link>
          <Link href="/syllabus" className="hover:text-blue-600 transition-colors">
            Syllabus
          </Link>
          <Link href="/admin" className="hover:text-blue-600 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}

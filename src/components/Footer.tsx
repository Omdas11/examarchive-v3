export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 py-6 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
      <div className="mx-auto max-w-6xl px-4">
        © {new Date().getFullYear()} ExamArchive. All rights reserved.
      </div>
    </footer>
  );
}

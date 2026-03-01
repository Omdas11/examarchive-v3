"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/upload", label: "Upload" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <>
      <nav
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "color-mix(in srgb, var(--color-bg) 85%, transparent)",
        }}
      >
        <div className="mx-auto flex h-14 items-center justify-between px-4" style={{ maxWidth: "var(--max-w)" }}>
          {/* Mobile hamburger */}
          <button
            className="mr-3 md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 text-lg font-bold tracking-tight">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-white"
              style={{ background: "var(--color-primary)" }}
            >
              EA
            </span>
            <span>ExamArchive</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:opacity-70"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} aria-label="Toggle theme" className="p-1.5 rounded-md transition-colors hover:opacity-70">
            {dark ? (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm9-9a1 1 0 0 1 0 2h-1a1 1 0 1 1 0-2h1ZM5 11a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2h1Zm14.07-5.66a1 1 0 0 1 0 1.41l-.71.71a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.42 0ZM7.05 17.66a1 1 0 0 1 0 1.41l-.7.71a1 1 0 0 1-1.42-1.41l.71-.71a1 1 0 0 1 1.41 0Zm12.02 2.12a1 1 0 0 1-1.41 0l-.71-.71a1 1 0 0 1 1.41-1.41l.71.7a1 1 0 0 1 0 1.42ZM7.05 6.34a1 1 0 0 1-1.41 0l-.71-.7a1 1 0 0 1 1.41-1.42l.71.71a1 1 0 0 1 0 1.41ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/></svg>
            ) : (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12.1 22c5.52 0 10-4.48 10-10 0-4.75-3.31-8.72-7.75-9.74a.78.78 0 0 0-.9 1.01 8.27 8.27 0 0 1-8.17 10.36.78.78 0 0 0-.56 1.3A9.98 9.98 0 0 0 12.1 22Z"/></svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="relative z-10 flex w-64 flex-col gap-1 p-5 shadow-xl"
            style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold">ExamArchive</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <hr style={{ borderColor: "var(--color-border)" }} />
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setDrawerOpen(false)}
                className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
              >
                {l.label}
              </Link>
            ))}
            <hr style={{ borderColor: "var(--color-border)" }} className="my-1" />
            <Link
              href="/admin"
              onClick={() => setDrawerOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
            >
              Admin
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

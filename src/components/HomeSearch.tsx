"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SearchSuggestion {
  type: "paper" | "syllabus" | "browse";
  label: string;
  sublabel?: string;
  href: string;
}

export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch live suggestions from Appwrite via API
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch(`/api/search?${new URLSearchParams({ q: trimmed })}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([
            {
              type: "browse",
              label: `Search papers for "${trimmed}"`,
              sublabel: "Browse all papers",
              href: `/browse?${new URLSearchParams({ search: trimmed }).toString()}`,
            },
          ]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([
            {
              type: "browse",
              label: `Search papers for "${trimmed}"`,
              sublabel: "Browse all papers",
              href: `/browse?${new URLSearchParams({ search: trimmed }).toString()}`,
            },
          ]);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/browse");
    } else {
      router.push(`/browse?${new URLSearchParams({ search: trimmed }).toString()}`);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(e.target.value.trim().length > 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="space-y-3">
      <div ref={wrapperRef} className="relative">
        <form
          onSubmit={handleSearch}
          className="bg-surface flex flex-col gap-3 p-2 pl-6 sm:flex-row sm:items-center rounded-full shadow-floating border border-outline-variant/10 group focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300"
        >
          <input
            type="search"
            placeholder="Search exam papers, notes, subject codes…"
            className="flex-1 bg-transparent border-none outline-none text-on-surface placeholder-on-surface-variant/60 text-base py-3"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim() && setOpen(true)}
            autoComplete="off"
            aria-label="Search exam papers and notes"
          />
          <button
            type="submit"
            className="btn-primary text-sm font-bold whitespace-nowrap px-8 py-3 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            Search
          </button>
        </form>

        {/* Popup suggestions */}
        {open && suggestions.length > 0 && (
          <ul
            aria-label="Search suggestions"
            className="absolute left-0 right-0 z-50 mt-3 rounded-3xl shadow-xl overflow-hidden list-none m-0 p-2 animate-fade-in"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {suggestions.map((s, i) => (
              <li key={i}>
                <Link
                  href={s.href}
                  onClick={() => { setOpen(false); setQuery(""); }}
                  className="flex items-center gap-4 px-5 py-3.5 text-sm transition-all rounded-2xl hover:bg-surface-container-low hover:translate-x-1"
                >
                  {/* Icon by type */}
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
                    {s.type === "paper" && (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {s.type === "syllabus" && (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {s.type === "browse" && (
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-on-surface truncate block">{s.label}</span>
                    {s.sublabel && (
                      <span className="text-[11px] font-medium uppercase tracking-wider truncate block opacity-60">
                        {s.sublabel}
                      </span>
                    )}
                  </span>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-primary/40">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

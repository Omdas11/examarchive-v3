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
          className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
        >
          <input
            type="search"
            placeholder="Search exam papers, notes, subject codes…"
            className="input-field flex-1"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim() && setOpen(true)}
            autoComplete="off"
            aria-label="Search exam papers and notes"
          />
          <button type="submit" className="btn-primary text-sm whitespace-nowrap">
            Search
          </button>
        </form>

        {/* Popup suggestions */}
        {open && suggestions.length > 0 && (
          <ul
            aria-label="Search suggestions"
            className="absolute left-0 right-0 z-50 mt-1 rounded-lg shadow-lg overflow-hidden list-none m-0 p-0"
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
                  className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                  style={{ borderBottom: i < suggestions.length - 1 ? "1px solid var(--color-border)" : undefined }}
                >
                  {/* Icon by type */}
                  <span className="shrink-0" style={{ color: "var(--color-primary)" }}>
                    {s.type === "paper" && (
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {s.type === "syllabus" && (
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {s.type === "browse" && (
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{s.label}</span>
                    {s.sublabel && (
                      <span className="text-xs truncate block" style={{ color: "var(--color-text-muted)" }}>
                        {s.sublabel}
                      </span>
                    )}
                  </span>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--color-text-muted)" }} className="shrink-0">
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

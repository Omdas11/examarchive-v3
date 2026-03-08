"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const QUICK_SEARCHES = ["Physics", "Chemistry", "Mathematics", "English", "History"];

export default function HomeSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/browse");
    } else {
      router.push(`/browse?${new URLSearchParams({ search: trimmed }).toString()}`);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search exam papers, notes, subject codes…"
          className="input-field flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-label="Search exam papers and notes"
        />
        <button type="submit" className="btn-primary text-sm whitespace-nowrap">
          Search
        </button>
      </form>

      {/* Quick-search suggestions */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Popular:</span>
        {QUICK_SEARCHES.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() =>
              router.push(`/browse?${new URLSearchParams({ search: term }).toString()}`)
            }
            className="rounded-full px-3 py-0.5 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              background: "var(--color-accent-soft)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-border)",
            }}
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

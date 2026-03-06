"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <form onSubmit={handleSearch} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <input
        type="text"
        placeholder="Search papers, subjects, codes…"
        className="input-field flex-1"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        aria-label="Search papers"
      />
      <button type="submit" className="btn-primary text-sm">
        Search
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";

type Target = {
  code: string;
  department: string;
  year: number;
  filename: string;
};

const TARGETS: Target[] = [
  { code: "PHSHCC401T", department: "Physics", year: 2022, filename: "physics_tdc-4-sem-physics-mathematical-physics-3-113-2022.pdf" },
  { code: "PHSHCC201T", department: "Physics", year: 2022, filename: "physics_tdc-2-sem-physics-electricity-and-magnetism-110-2022.pdf" },
  { code: "PHSHCC202T", department: "Physics", year: 2022, filename: "physics_tdc-2-sem-physics-waves-and-optics-111-2022.pdf" },
  { code: "PHSSEC401T", department: "Physics", year: 2022, filename: "physics_tdc-4-sem-physics-electrical-circuits-and-network-117-2022.pdf" },
  { code: "PHSHCC601T", department: "Physics", year: 2022, filename: "physics_tdc-6-sem-physics-electromagnetic-theory-118-2022.pdf" },
  { code: "PHSSEC601T", department: "Physics", year: 2022, filename: "physics_tdc-6-sem-physics-renewable-energy-and-energy-harvesting-122-2022.pdf" },
  { code: "PHSHCC502T", department: "Physics", year: 2021, filename: "physics_tdc-5-sem-physics-solid-state-physics-156-2021.pdf" },
  { code: "CHMHCC403T", department: "Chemistry", year: 2022, filename: "chemistry_tdc-4-sem-chemistry-341-2022.pdf" },
  { code: "CHMSEC401T", department: "Chemistry", year: 2022, filename: "chemistry_tdc-4-sem-chemistry-fuel-chemistry-343-2022.pdf" },
  { code: "MTMHCC201T", department: "Mathematics", year: 2022, filename: "mathematics_tdc-2-sem-mathematics-real-analysis-256-2022.pdf" },
  { code: "MTMHCC602T", department: "Mathematics", year: 2022, filename: "mathematics_tdc-6-sem-mathematics-linear-algebra-265-2022.pdf" },
];

type Paper = {
  $id: string;
  paper_name?: string;
  course_code?: string;
  department?: string;
  year?: number;
  file_url?: string;
};

type RowState = {
  target: Target;
  paper: Paper | null;
  error: string | null;
  result: string | null;
  busy: boolean;
};

const norm = (s: string) => s.replace(/-/g, "").toLowerCase();

export default function ReplaceFilesClient() {
  const [rows, setRows] = useState<RowState[]>(
    TARGETS.map((target) => ({ target, paper: null, error: null, result: null, busy: false })),
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next = await Promise.all(
        TARGETS.map(async (target) => {
          try {
            const res = await fetch(
              `/api/papers?department=${encodeURIComponent(target.department)}&year=${target.year}`,
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const docs: Paper[] = Array.isArray(data) ? data : (data.papers ?? data.documents ?? []);
            const matches = docs.filter(
              (d) => typeof d.course_code === "string" && norm(d.course_code) === norm(target.code),
            );
            if (matches.length !== 1) {
              return {
                target,
                paper: null,
                error: `Expected 1 match, found ${matches.length}. Skipped.`,
                result: null,
                busy: false,
              };
            }
            return { target, paper: matches[0], error: null, result: null, busy: false };
          } catch (e) {
            return {
              target,
              paper: null,
              error: e instanceof Error ? e.message : "Failed to load",
              result: null,
              busy: false,
            };
          }
        }),
      );
      if (!cancelled) setRows(next);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function replace(index: number, file: File | null) {
    const row = rows[index];
    if (!row.paper || !file || row.busy) return;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, busy: true, result: null } : r)));
    try {
      const fd = new FormData();
      fd.append("action", "replace_file");
      fd.append("id", row.paper.$id);
      fd.append("file", file, file.name);
      const res = await fetch("/api/admin", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      const msg = res.ok && body.success
        ? `OK — replaced (new file id ${body.file_id ?? "unknown"}).`
        : `FAILED — ${body.error ?? `HTTP ${res.status}`}`;
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, busy: false, result: msg } : r)));
    } catch (e) {
      setRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? { ...r, busy: false, result: `FAILED — ${e instanceof Error ? e.message : "network error"}` }
            : r,
        ),
      );
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {rows.map((row, i) => (
        <div key={row.target.code} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="font-semibold">{row.target.code}</div>
              <div className="text-sm opacity-70">
                {row.paper
                  ? `${row.paper.paper_name ?? "Untitled"} · ${row.target.department} · ${row.target.year}`
                  : `${row.target.department} · ${row.target.year}`}
              </div>
              <div className="text-xs opacity-50">Clean file: {row.target.filename}</div>
            </div>
            {row.paper && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement | null;
                  replace(i, input?.files?.[0] ?? null);
                }}
              >
                <input type="file" accept="application/pdf" aria-label={`Cleaned PDF for ${row.target.code}`} />
                <button
                  type="submit"
                  disabled={row.busy}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {row.busy ? "Replacing…" : "Replace"}
                </button>
              </form>
            )}
          </div>
          {row.error && <div className="mt-2 text-sm text-red-600">{row.error}</div>}
          {row.result && (
            <div className={`mt-2 text-sm ${row.result.startsWith("OK") ? "text-green-700" : "text-red-600"}`}>
              {row.result}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

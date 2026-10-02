"use client";

import { useEffect, useState } from "react";

type Target = {
  code: string;
  department: string;
  year: number;
  filename: string;
};

const TARGETS: Target[] = [
  { code: "BNGHCC101", department: "Bengali", year: 2021, filename: "1718977017_1st-sem-2021-bng-hcc-101.pdf" },
  { code: "BNGHCC102", department: "Bengali", year: 2021, filename: "1718977051_1st-sem-2021-bng-hcc-102.pdf" },
  { code: "BNGAEC101T", department: "Bengali", year: 2021, filename: "1718977083_1st-sem-2021-bng-aec-101.pdf" },
  { code: "BNGDSC/GE101T", department: "Bengali", year: 2021, filename: "1718977129_1st-sem-2021-bng-dsc-ge-101.pdf" },
  { code: "BNGHCC301", department: "Bengali", year: 2019, filename: "1718978325_3rd-sem-2019-bng-hcc-301.pdf" },
  { code: "BNGHCC302", department: "Bengali", year: 2019, filename: "1718978358_3rd-sem-2019-bng-hcc-302.pdf" },
  { code: "BNGHCC303", department: "Bengali", year: 2019, filename: "1718978386_3rd-sem-2019-bng-hcc-303.pdf" },
  { code: "BNGSEC301", department: "Bengali", year: 2019, filename: "1718978430_3rd-sem-2019-bng-sec-301.pdf" },
  { code: "BNGDSC301", department: "Bengali", year: 2019, filename: "1718978482_3rd-sem-2019-bng-dsc-301.pdf" },
  { code: "BNGLAN301", department: "Bengali", year: 2019, filename: "1718978517_3rd-sem-2019-bng-lan-301.pdf" },
  { code: "BNGHCC301", department: "Bengali", year: 2020, filename: "1718979058_3rd-sem-2020-bng-hcc-301.pdf" },
  { code: "BNGHCC302", department: "Bengali", year: 2020, filename: "1718979094_3rd-sem-2020-bng-hcc-302.pdf" },
  { code: "BNGHCC303", department: "Bengali", year: 2020, filename: "1718979120_3rd-sem-2020-bng-hcc-303.pdf" },
  { code: "BNGHCC301", department: "Bengali", year: 2021, filename: "1718979178_3rd-sem-2021-bng-hcc-301.pdf" },
  { code: "BNGHCC302", department: "Bengali", year: 2021, filename: "1718979211_3rd-sem-2021-bng-hcc-302.pdf" },
  { code: "BNGHCC303", department: "Bengali", year: 2021, filename: "1718979243_3rd-sem-2021-bng-hcc-303.pdf" },
  { code: "BNGDSC301", department: "Bengali", year: 2021, filename: "1718979284_3rd-sem-2021-bng-dsc-301.pdf" },
  { code: "BNGLAN301", department: "Bengali", year: 2021, filename: "1718979322_3rd-sem-2021-bng-lan-301.pdf" },
  { code: "BNGSEC301", department: "Bengali", year: 2021, filename: "1718979356_3rd-sem-2021-bng-sec-301.pdf" },
  { code: "BNGHCC301", department: "Bengali", year: 2022, filename: "1718979420_3rd-sem-2022-bng-hcc-301.pdf" },
  { code: "BNGHCC302", department: "Bengali", year: 2022, filename: "1718979452_3rd-sem-2022-bng-hcc-302.pdf" },
  { code: "BNGHCC303", department: "Bengali", year: 2022, filename: "1718979495_3rd-sem-2022-bng-hcc-303.pdf" },
  { code: "BNGLAN301", department: "Bengali", year: 2022, filename: "1718979543_3rd-sem-2022-bng-lan-301.pdf" },
  { code: "BNGSEC301", department: "Bengali", year: 2022, filename: "1718979576_3rd-sem-2022-bng-sec-301.pdf" },
  { code: "BNGDSC/GE301T", department: "Bengali", year: 2022, filename: "1718979619_3rd-sem-2022-bng-dscge-301.pdf" },
  { code: "BNGHCC401T", department: "Bengali", year: 2022, filename: "1718980164_4th-sem-2022.pdf" },
  { code: "BNGHCC402T", department: "Bengali", year: 2022, filename: "1718980189_4th-sem-2022.pdf" },
  { code: "BNGHCC403T", department: "Bengali", year: 2022, filename: "1718980213_4th-sem-2022.pdf" },
  { code: "BNGLAN401T", department: "Bengali", year: 2022, filename: "1718980238_4th-sem-2022.pdf" },
  { code: "BNGDSC/GEC401T", department: "Bengali", year: 2022, filename: "1718980262_4th-sem-2022.pdf" },
  { code: "BNGHCC401T", department: "Bengali", year: 2023, filename: "1718980294_4th-sem-2023.pdf" },
  { code: "BNGHCC402T", department: "Bengali", year: 2023, filename: "1718980314_4th-sem-2023.pdf" },
  { code: "BNGDSC/GE401T", department: "Bengali", year: 2023, filename: "1718980399_4th-sem-2023.pdf" },
  { code: "BNGSEC401T", department: "Bengali", year: 2023, filename: "1718980428_4th-sem-2023.pdf" },
  { code: "BNGHCC601T", department: "Bengali", year: 2022, filename: "1718985207_6th-sem-2022.pdf" },
  { code: "BNGHCC501T", department: "Bengali", year: 2021, filename: "1718985741_5th-sem-2021.pdf" },
  { code: "BNGHCC501T", department: "Bengali", year: 2022, filename: "1718985769_5th-sem-2022.pdf" },
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

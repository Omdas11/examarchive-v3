"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultExamDate,
  getItemsForDate,
  type HgcExamDate,
  type HgcExamItem,
} from "@/lib/hgc-exam-timetable";
import { normalizePaperCode } from "@/lib/syllabus-table";

export interface RelatedPaperLink {
  id: string;
  paperName: string;
  year: number;
}

export interface TimetableLookupEntry {
  papersByYear: Record<string, RelatedPaperLink[]>;
  syllabusUnits: number;
  syllabusHref: string | null;
}

export interface ExamTimetableSummary {
  total: number;
  have: number;
  missing: number;
  missingByCode: number;
  labelOnly: number;
}

interface Props {
  dates: HgcExamDate[];
  items: HgcExamItem[];
  lookup: Record<string, TimetableLookupEntry>;
  summary: ExamTimetableSummary;
  /** UTC date (YYYY-MM-DD) at request time; corrected to the visitor's local date on mount. */
  todayIso: string;
}

const YEARS = [2023, 2024, 2025, 2026];

function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateLabel(dates: HgcExamDate[], iso: string): string {
  const found = dates.find((d) => d.iso === iso);
  return found ? `${found.weekday}, ${found.label} 2026` : iso;
}

export default function ExamTimetableClient({
  dates,
  items,
  lookup,
  summary,
  todayIso,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultExamDate(todayIso),
  );
  const [focusMode, setFocusMode] = useState<"grey" | "hide">("grey");
  const [query, setQuery] = useState("");

  // Correct the default date to the visitor's local date once mounted.
  // (Server renders with its UTC date; exams run on IST daytime.)
  useEffect(() => {
    setSelectedDate((prev) => {
      const local = defaultExamDate(localTodayIso());
      return local === prev ? prev : local;
    });
  }, []);

  const visibleDates = useMemo(
    () =>
      focusMode === "hide"
        ? dates.filter((d) => d.iso === selectedDate)
        : dates,
    [dates, focusMode, selectedDate],
  );

  const itemsByDateSubject = useMemo(() => {
    const map = new Map<string, HgcExamItem[]>();
    for (const item of items) {
      const key = `${item.date}|${item.subject}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const subjects = useMemo(
    () => [...new Set(items.map((i) => i.subject))],
    [items],
  );

  const normalizedQuery = normalizePaperCode(query);
  const searching = normalizedQuery.length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return items.filter((item) => {
      const hay = normalizePaperCode(item.code);
      const canonical = item.canonicalCode ?? "";
      return (
        hay.includes(normalizedQuery) || canonical.includes(normalizedQuery)
      );
    });
  }, [items, searching, normalizedQuery]);

  const selectedItems = useMemo(
    () => getItemsForDate(selectedDate),
    [selectedDate],
  );

  const entryFor = (item: HgcExamItem) =>
    item.canonicalCode ? lookup[item.canonicalCode] : undefined;

  const statusFor = (item: HgcExamItem): "have" | "missing" | "label" => {
    if (!item.canonicalCode) return "label";
    const entry = lookup[item.canonicalCode];
    const count = entry
      ? Object.values(entry.papersByYear).reduce(
          (n, list) => n + list.length,
          0,
        )
      : 0;
    return count > 0 ? "have" : "missing";
  };

  const renderPaperCard = (item: HgcExamItem, key: string) => {
    const status = statusFor(item);
    const entry = entryFor(item);
    return (
      <article
        key={key}
        className="border p-4"
        style={{ borderColor: "var(--color-border)", background: "#fff" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-bold">{item.code}</h3>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--color-text-muted)" }}
            >
              {item.subject} —{" "}
              {item.session === "AM" ? "AM (9:30-12:30)" : "PM (1:30-4:30)"}
              {item.canonicalCode && item.canonicalCode !== item.code
                ? ` — filed as ${item.canonicalCode}`
                : ""}
            </p>
          </div>
          {status === "have" ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              Have paper
            </span>
          ) : status === "missing" ? (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
              Missing
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
              Label only
            </span>
          )}
        </div>

        {status === "label" ? (
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            No paper code in the programme for this slot, so there is nothing
            to look up. Check the admit card if a paper turns up under a
            different name.
          </p>
        ) : (
          <div className="mt-3">
            <p className="text-xs font-semibold">Related question papers</p>
            <ul className="mt-1 space-y-1 text-sm">
              {YEARS.map((year) => {
                const papers = entry?.papersByYear[String(year)] ?? [];
                return (
                  <li key={year} className="flex flex-wrap gap-x-2">
                    <span className="w-10 shrink-0 font-semibold">{year}</span>
                    {papers.length > 0 ? (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {papers.map((p) => (
                          <a
                            key={p.id}
                            href={`/paper/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 underline"
                          >
                            {p.paperName}
                          </a>
                        ))}
                      </span>
                    ) : year === 2026 ? (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        after exam
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        —
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Syllabus: </span>
              {entry && entry.syllabusUnits > 0 ? (
                <>
                  {entry.syllabusUnits} units —{" "}
                  <a
                    href={entry.syllabusHref ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline"
                  >
                    Open syllabus
                  </a>
                </>
              ) : (
                <span style={{ color: "var(--color-text-muted)" }}>
                  not on site
                </span>
              )}
            </p>
          </div>
        )}
      </article>
    );
  };

  return (
    <div>
      {/* Summary + syllabus notice */}
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="border px-3 py-1.5" style={{ borderColor: "var(--color-border)" }}>
          Total: <strong>{summary.total}</strong>
        </span>
        <span className="border px-3 py-1.5" style={{ borderColor: "var(--color-border)" }}>
          Have paper: <strong>{summary.have}</strong>
        </span>
        <span className="border px-3 py-1.5" style={{ borderColor: "var(--color-border)" }}>
          Missing: <strong>{summary.missing}</strong> ({summary.missingByCode}{" "}
          by code, {summary.labelOnly} label-only)
        </span>
      </div>
      <p
        className="mb-6 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Note: syllabus pages are currently disabled site-wide, so syllabus
        links below return a 503 until syllabus is re-enabled. They are shown
        here for tracking — the unit counts come from the syllabus data, not
        the live pages.
      </p>

      {/* Date selector */}
      <div className="mb-4">
        <label
          htmlFor="exam-date"
          className="mb-1 block text-xs font-semibold"
        >
          Exam date
        </label>
        <select
          id="exam-date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full max-w-xs border bg-white px-3 py-2 text-sm"
          style={{ borderColor: "var(--color-border)" }}
        >
          {dates.map((d) => (
            <option key={d.iso} value={d.iso}>
              {d.weekday}, {d.label} 2026
            </option>
          ))}
        </select>
      </div>

      {/* Focus mode + search */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1 block text-xs font-semibold">
            Other dates
          </span>
          <div
            className="inline-flex border"
            style={{ borderColor: "var(--color-border)" }}
            role="group"
            aria-label="Focus mode"
          >
            <button
              type="button"
              onClick={() => setFocusMode("grey")}
              aria-pressed={focusMode === "grey"}
              className="px-3 py-2 text-sm"
              style={{
                background:
                  focusMode === "grey" ? "#047857" : "#fff",
                color: focusMode === "grey" ? "#fff" : "inherit",
              }}
            >
              Grey out others
            </button>
            <button
              type="button"
              onClick={() => setFocusMode("hide")}
              aria-pressed={focusMode === "hide"}
              className="px-3 py-2 text-sm"
              style={{
                background:
                  focusMode === "hide" ? "#047857" : "#fff",
                color: focusMode === "hide" ? "#fff" : "inherit",
              }}
            >
              Hide others
            </button>
          </div>
        </div>
        <div className="min-w-52 flex-1">
          <label
            htmlFor="code-search"
            className="mb-1 block text-xs font-semibold"
          >
            Search paper code
          </label>
          <input
            id="code-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. PHYDSC301T"
            className="w-full border bg-white px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
      </div>

      {/* Full timetable grid */}
      <div
        className="mb-8 overflow-x-auto rounded-lg"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <table className="zebra-table sticky-col-table min-w-full text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap text-left text-xs font-semibold">
                Subject
              </th>
              {visibleDates.map((d) => (
                <th
                  key={d.iso}
                  className="whitespace-nowrap text-left text-xs font-semibold"
                  style={
                    d.iso === selectedDate
                      ? { background: "#047857", color: "#fff" }
                      : undefined
                  }
                >
                  {d.weekday} {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject}>
                <th className="whitespace-nowrap text-left text-xs font-semibold">
                  {subject}
                </th>
                {visibleDates.map((d) => {
                  const cellItems =
                    itemsByDateSubject.get(`${d.iso}|${subject}`) ?? [];
                  const dimmed =
                    focusMode === "grey" && d.iso !== selectedDate;
                  return (
                    <td
                      key={d.iso}
                      className="whitespace-nowrap align-top text-xs"
                      style={
                        dimmed
                          ? { opacity: 0.35 }
                          : d.iso === selectedDate
                            ? { background: "#ecfdf5" }
                            : undefined
                      }
                    >
                      {cellItems.map((item) => (
                        <span key={item.code} className="mb-1 block">
                          <span className="font-semibold">{item.code}</span>{" "}
                          <span
                            className="inline-block px-1 text-[10px] font-semibold"
                            style={{
                              background:
                                item.session === "AM" ? "#e0e7ff" : "#fef3c7",
                              color:
                                item.session === "AM" ? "#3730a3" : "#92400e",
                            }}
                          >
                            {item.session}
                          </span>
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded date / search results */}
      {searching ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">
            Search: {searchResults.length} matching paper
            {searchResults.length !== 1 ? "s" : ""} for “{query.trim()}”
          </h2>
          {searchResults.length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              No timetable slot matches that code.
            </p>
          ) : (
            <div className="space-y-3">
              {searchResults.map((item) => (
                <div key={`${item.date}|${item.subject}|${item.code}`}>
                  <p
                    className="mb-1 text-xs font-semibold"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {dateLabel(dates, item.date)}
                  </p>
                  {renderPaperCard(
                    item,
                    `${item.date}|${item.subject}|${item.code}`,
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold">
            {dateLabel(dates, selectedDate)} — {selectedItems.length} papers
          </h2>
          <div className="space-y-3">
            {selectedItems.map((item) =>
              renderPaperCard(
                item,
                `${item.date}|${item.subject}|${item.code}`,
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

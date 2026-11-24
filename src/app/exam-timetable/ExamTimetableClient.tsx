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
  /** False while syllabus pages are disabled site-wide: unit counts are shown as plain text, no links. */
  syllabusLinksEnabled: boolean;
}

const YEARS = [2023, 2024, 2025, 2026];

const SUBMIT_FORM_URL = "https://forms.gle/kDnGMqF7L4ic9oho8";

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

type Filter = "all" | "have" | "missing";

export default function ExamTimetableClient({
  dates,
  items,
  lookup,
  summary,
  todayIso,
  syllabusLinksEnabled,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultExamDate(todayIso),
  );
  const [focusMode, setFocusMode] = useState<"grey" | "hide">("grey");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Correct the default date to the visitor's local date once mounted.
  // (Server renders with its UTC date; exams run on IST daytime.)
  useEffect(() => {
    setSelectedDate((prev) => {
      const local = defaultExamDate(localTodayIso());
      return local === prev ? prev : local;
    });
  }, []);

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

  /** Newest paper on the site for this slot, for the one-tap button. */
  const latestPaperFor = (
    item: HgcExamItem,
  ): RelatedPaperLink | null => {
    const entry = entryFor(item);
    if (!entry) return null;
    for (const year of [...YEARS].sort((a, b) => b - a)) {
      const papers = entry.papersByYear[String(year)] ?? [];
      if (papers.length > 0) return papers[0];
    }
    return null;
  };

  const countsByDate = useMemo(() => {
    const map = new Map<string, { have: number; total: number }>();
    for (const item of items) {
      const c = map.get(item.date) ?? { have: 0, total: 0 };
      c.total += 1;
      if (statusFor(item) === "have") c.have += 1;
      map.set(item.date, c);
    }
    return map;
    // statusFor/lookup are stable props; recompute when items change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lookup]);

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

  const applyFilter = (list: HgcExamItem[]) =>
    filter === "all"
      ? list
      : list.filter((item) => statusFor(item) === filter);

  // Next exam from the visitor's local date: today when it is an exam
  // date, otherwise the next upcoming one; null once the programme is over.
  const [localToday, setLocalToday] = useState(todayIso);
  useEffect(() => {
    setLocalToday(localTodayIso());
  }, []);
  const nextDateIso = defaultExamDate(localToday);
  const programmeOver = localToday > dates[dates.length - 1].iso;
  const nextCounts = countsByDate.get(nextDateIso);
  const nextIsToday = nextDateIso === localToday;

  const renderPaperCard = (item: HgcExamItem, key: string) => {
    const status = statusFor(item);
    const entry = entryFor(item);
    const latest = latestPaperFor(item);
    // Only show the "filed as" note for the BEN/BNG and POL/PLS aliases,
    // where the stored code genuinely looks different from the programme
    // code. Variant slots (COMIDC201AT filed as COMIDC201TA) differ only
    // by letter position, so no note there.
    const aliasNote =
      item.canonicalCode &&
      item.canonicalCode !== item.code &&
      item.canonicalCode.slice(0, 3) !== item.code.slice(0, 3)
        ? ` — filed as ${item.canonicalCode}`
        : "";
    return (
      <article
        key={key}
        className="rounded-lg border p-4 sm:p-5"
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
              {aliasNote}
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
            {status === "have" && latest ? (
              <a
                href={`/paper/${latest.id}`}
                target="_blank"
                rel="noreferrer"
                className="mb-3 inline-flex max-w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white"
                style={{ background: "#047857" }}
              >
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  picture_as_pdf
                </span>
                <span className="min-w-0 truncate">
                  Latest paper ({latest.year}): {latest.paperName}
                </span>
              </a>
            ) : (
              <p className="mb-3 text-sm">
                <span style={{ color: "var(--color-text-muted)" }}>
                  No past paper for this code yet.{" "}
                </span>
                <a
                  href={SUBMIT_FORM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-700 underline"
                >
                  Submit this paper
                </a>
              </p>
            )}
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
                syllabusLinksEnabled && entry.syllabusHref ? (
                  <>
                    {entry.syllabusUnits} units —{" "}
                    <a
                      href={entry.syllabusHref}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 underline"
                    >
                      Open syllabus
                    </a>
                  </>
                ) : (
                  <span>{entry.syllabusUnits} units</span>
                )
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

  const havePct =
    summary.total > 0 ? Math.round((summary.have / summary.total) * 100) : 0;

  return (
    <div>
      {/* Next exam hero */}
      {!programmeOver && nextCounts && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
          style={{
            borderColor: "var(--color-border)",
            background:
              "linear-gradient(120deg, #ecfdf5, #eff6ff)",
          }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              {nextIsToday ? "Today's exam" : "Next exam"}
            </p>
            <p className="mt-0.5 text-lg font-bold">
              {dateLabel(dates, nextDateIso)} — {nextCounts.total} papers,{" "}
              {nextCounts.have} on site
            </p>
            <p
              className="mt-0.5 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              {nextCounts.total - nextCounts.have > 0
                ? `${nextCounts.total - nextCounts.have} paper${nextCounts.total - nextCounts.have !== 1 ? "s" : ""} still missing for that day.`
                : "Every paper for that day is on the site."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(nextDateIso)}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ background: "#047857" }}
          >
            View that day
          </button>
        </div>
      )}

      {/* Summary with progress */}
      <div
        className="mb-4 rounded-lg border p-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            <strong>{summary.have} of {summary.total}</strong> exam slots
            have a paper on the site
          </span>
          <span style={{ color: "var(--color-text-muted)" }}>
            {summary.missingByCode} missing by code · {summary.labelOnly}{" "}
            label-only
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={havePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${summary.have} of ${summary.total} exam slots have a paper`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${havePct}%`,
              background: "linear-gradient(90deg, #047857, #2563eb)",
            }}
          />
        </div>
      </div>
      {!syllabusLinksEnabled && (
        <p
          className="mb-6 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          Note: syllabus pages are being checked and will return soon, so
          syllabus links are hidden for now — the unit counts below come from
          the syllabus data.
        </p>
      )}

      {/* Date chips */}
      <div className="mb-4">
        <span className="mb-1 block text-xs font-semibold">Exam date</span>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Exam date"
        >
          {dates.map((d) => {
            const c = countsByDate.get(d.iso) ?? { have: 0, total: 0 };
            const selected = d.iso === selectedDate;
            const past = d.iso < localToday;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => setSelectedDate(d.iso)}
                aria-pressed={selected}
                className="shrink-0 rounded-lg border px-3 py-2 text-left text-xs"
                style={{
                  borderColor: selected
                    ? "#047857"
                    : "var(--color-border)",
                  background: selected ? "#047857" : "#fff",
                  color: selected ? "#fff" : "inherit",
                  opacity: past && !selected ? 0.6 : 1,
                }}
              >
                <span className="block font-bold">
                  {d.weekday} {d.label}
                </span>
                <span
                  className="block"
                  style={
                    selected
                      ? { color: "rgba(255,255,255,0.85)" }
                      : { color: "var(--color-text-muted)" }
                  }
                >
                  {c.have}/{c.total} papers
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus mode + filter + search */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1 block text-xs font-semibold">
            Other dates
          </span>
          <div
            className="inline-flex overflow-hidden rounded-lg border"
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
        <div>
          <span className="mb-1 block text-xs font-semibold">Show</span>
          <div
            className="inline-flex overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--color-border)" }}
            role="group"
            aria-label="Filter by availability"
          >
            {(["all", "have", "missing"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className="px-3 py-2 text-sm capitalize"
                style={{
                  background: filter === f ? "#047857" : "#fff",
                  color: filter === f ? "#fff" : "inherit",
                }}
              >
                {f === "all"
                  ? "All"
                  : f === "have"
                    ? "Have paper"
                    : "Missing"}
              </button>
            ))}
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
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
      </div>

      {/* Full timetable grid.
          Fixed layout + explicit col widths: every date column is
          guaranteed 152px, so no column can ever collapse to zero
          width and one day's codes can never print on top of the
          next day's (Mon 23 Nov was rendering at zero width, its
          DSM201T codes overlapping Sat 21 Nov's DSC301T codes). */}
      <div
        className="mb-8 overflow-x-auto rounded-lg"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <table className="zebra-table sticky-col-table table-fixed min-w-full text-sm">
          <colgroup>
            <col style={{ width: 200 }} />
            {visibleDates.map((d) => (
              <col key={d.iso} style={{ width: 152 }} />
            ))}
          </colgroup>
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
                  <button
                    type="button"
                    onClick={() => setSelectedDate(d.iso)}
                    className="text-left font-semibold"
                    style={
                      d.iso === selectedDate
                        ? { color: "#fff" }
                        : undefined
                    }
                    title={`Show ${d.weekday}, ${d.label}`}
                  >
                    {d.weekday} {d.label}
                  </button>
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
                      className="align-top text-xs"
                      style={
                        dimmed
                          ? { opacity: 0.35 }
                          : d.iso === selectedDate
                            ? { background: "#ecfdf5" }
                            : undefined
                      }
                    >
                      <div className="flex flex-col gap-1.5">
                      {cellItems.map((item) => {
                        const st = statusFor(item);
                        return (
                          <div key={item.code} className="flex items-center gap-1.5">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{
                                background:
                                  st === "have"
                                    ? "#059669"
                                    : st === "missing"
                                      ? "#dc2626"
                                      : "#94a3b8",
                              }}
                              title={
                                st === "have"
                                  ? "Paper on site"
                                  : st === "missing"
                                    ? "Paper missing"
                                    : "No paper code"
                              }
                            />
                            <span className="whitespace-nowrap font-semibold">{item.code}</span>{" "}
                            <span
                              className="inline-block shrink-0 rounded px-1 text-[10px] font-semibold"
                              style={{
                                background:
                                  item.session === "AM" ? "#e0e7ff" : "#fef3c7",
                                color:
                                  item.session === "AM" ? "#3730a3" : "#92400e",
                              }}
                            >
                              {item.session}
                            </span>
                          </div>
                        );
                      })}
                      </div>
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
            Search: {applyFilter(searchResults).length} matching paper
            {applyFilter(searchResults).length !== 1 ? "s" : ""} for “
            {query.trim()}”
          </h2>
          {applyFilter(searchResults).length === 0 ? (
            <p
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              No timetable slot matches that code.
            </p>
          ) : (
            <div className="space-y-3">
              {applyFilter(searchResults).map((item) => (
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
            {dateLabel(dates, selectedDate)} —{" "}
            {applyFilter(selectedItems).length} of {selectedItems.length}{" "}
            papers
          </h2>
          <div className="space-y-3">
            {applyFilter(selectedItems).map((item) =>
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

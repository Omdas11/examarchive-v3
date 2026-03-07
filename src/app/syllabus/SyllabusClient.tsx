"use client";

import { useState } from "react";
import Link from "next/link";
import type { Syllabus } from "@/types";
import { toRoman } from "@/lib/utils";
import { SYLLABUS_REGISTRY, groupBySemester } from "@/data/syllabus-registry";
import type { SyllabusRegistryEntry } from "@/data/syllabus-registry";

type Tab = "pdfs" | "library";

interface SyllabusClientProps {
  syllabi: Syllabus[];
}

/** Format a semester value for display (e.g. "1" → "Semester I"). */
function semLabel(sem: string | number | null | undefined): string {
  if (sem == null || sem === "") return "";
  const n = typeof sem === "number" ? sem : parseInt(String(sem), 10);
  if (!isNaN(n)) return `Semester ${toRoman(n)}`;
  return String(sem);
}

/** A single uploaded syllabus PDF card. */
function SyllabusPdfCard({ s }: { s: Syllabus }) {
  return (
    <div className="card p-4 flex flex-col gap-2 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      {/* University + programme */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
        >
          {s.university || "Unknown University"}
        </span>
        {s.programme && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            {s.programme}
          </span>
        )}
      </div>

      {/* Subject / Paper name */}
      <p className="text-sm font-semibold leading-snug">
        {s.subject || s.course_name || "Unnamed Subject"}
      </p>

      {/* Paper code */}
      {s.course_code && (
        <p className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
          {s.course_code}
        </p>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap gap-1">
        {s.semester && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-border)", color: "var(--color-primary)" }}
          >
            {semLabel(s.semester)}
          </span>
        )}
        {s.department && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            {s.department}
          </span>
        )}
        {s.year != null && s.year > 0 && (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px]"
            style={{ background: "var(--color-border)", color: "var(--color-text-muted)" }}
          >
            {s.year}
          </span>
        )}
      </div>

      {/* Download */}
      {s.file_url && (
        <div className="flex justify-end pt-1">
          <a
            href={s.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--color-primary)" }}
          >
            Download PDF
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

/** Tab 2: Paper Syllabus Library from the registry. */
function PaperLibrary() {
  const [filterProg, setFilterProg] = useState<string>("ALL");
  const [filterSubject, setFilterSubject] = useState<string>("ALL");

  const programmes = ["ALL", ...Array.from(new Set(SYLLABUS_REGISTRY.map((e) => e.programme))).sort()];
  const subjects = [
    "ALL",
    ...Array.from(
      new Set(
        SYLLABUS_REGISTRY.filter(
          (e) => filterProg === "ALL" || e.programme === filterProg,
        ).map((e) => e.subject),
      ),
    ).sort(),
  ];

  const filtered = SYLLABUS_REGISTRY.filter((e) => {
    if (filterProg !== "ALL" && e.programme !== filterProg) return false;
    if (filterSubject !== "ALL" && e.subject !== filterSubject) return false;
    return true;
  });

  const grouped = groupBySemester(filtered);

  function handleProgClick(p: string) {
    setFilterProg(p);
    setFilterSubject("ALL");
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-1">
          {programmes.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleProgClick(p)}
              className={`toggle-btn${filterProg === p ? " active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {subjects.length > 2 && (
        <div className="flex flex-wrap gap-1">
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSubject(s)}
              className={`toggle-btn${filterSubject === s ? " active" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        {filtered.length} paper{filtered.length !== 1 ? "s" : ""} in registry
      </p>

      {grouped.size === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--color-text-muted)" }}>
          No papers match the selected filters.
        </p>
      ) : (
        Array.from(grouped.entries()).map(([sem, entries]) => (
          <div key={sem}>
            <h3
              className="text-sm font-semibold mb-2 pb-1"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              {semLabel(sem)}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs uppercase text-left"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    <th className="pb-2 pr-4 font-medium">Paper Code</th>
                    <th className="pb-2 pr-4 font-medium">Paper Name</th>
                    <th className="pb-2 pr-4 font-medium">Subject</th>
                    <th className="pb-2 pr-4 font-medium">Credits</th>
                    <th className="pb-2 font-medium">Programme</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: SyllabusRegistryEntry) => (
                    <tr
                      key={e.paper_code}
                      className="border-t transition-colors hover:opacity-80"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <td className="py-2 pr-4">
                        <Link
                          href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                          className="font-mono text-xs font-semibold hover:underline"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {e.paper_code}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/syllabus/paper/${encodeURIComponent(e.paper_code)}`}
                          className="hover:underline"
                        >
                          {e.paper_name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {e.subject}
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {e.credits}
                      </td>
                      <td className="py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {e.programme}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function SyllabusClient({ syllabi }: SyllabusClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("pdfs");

  return (
    <div className="mt-6">
      {/* Tabs */}
      <div
        className="flex gap-0 border-b"
        style={{ borderColor: "var(--color-border)" }}
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={activeTab === "pdfs"}
          type="button"
          onClick={() => setActiveTab("pdfs")}
          className="px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={
            activeTab === "pdfs"
              ? {
                  color: "var(--color-primary)",
                  borderBottom: "2px solid var(--color-primary)",
                  marginBottom: "-1px",
                }
              : { color: "var(--color-text-muted)" }
          }
        >
          Available Syllabus PDFs
          {syllabi.length > 0 && (
            <span
              className="ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
            >
              {syllabi.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "library"}
          type="button"
          onClick={() => setActiveTab("library")}
          className="px-4 py-2.5 text-sm font-medium transition-colors relative"
          style={
            activeTab === "library"
              ? {
                  color: "var(--color-primary)",
                  borderBottom: "2px solid var(--color-primary)",
                  marginBottom: "-1px",
                }
              : { color: "var(--color-text-muted)" }
          }
        >
          Paper Syllabus Library
          <span
            className="ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}
          >
            {SYLLABUS_REGISTRY.length}
          </span>
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "pdfs" && (
        <div
          role="tabpanel"
          aria-label="Available Syllabus PDFs"
          className="mt-6"
        >
          {syllabi.length > 0 ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {syllabi.map((s) => (
                <SyllabusPdfCard key={s.id} s={s} />
              ))}
            </div>
          ) : (
            <div className="mt-8 text-center py-12">
              <svg
                className="mx-auto h-12 w-12 opacity-30"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
                No approved syllabi yet.
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <a href="/upload?type=syllabus" style={{ color: "var(--color-primary)" }}>
                  Upload a syllabus
                </a>{" "}
                to get started.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "library" && (
        <div role="tabpanel" aria-label="Paper Syllabus Library">
          <PaperLibrary />
        </div>
      )}
    </div>
  );
}

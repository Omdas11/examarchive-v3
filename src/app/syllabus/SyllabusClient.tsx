"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Syllabus } from "@/types";
import { toRoman } from "@/lib/utils";
import { makeAccentGradient } from "@/lib/gradients";

interface SyllabusClientProps {
  syllabi: Syllabus[];
  isAdmin?: boolean;
}

function semLabel(sem: string | number | null | undefined): string {
  if (sem == null || sem === "") return "";
  const n = typeof sem === "number" ? sem : parseInt(String(sem), 10);
  if (!isNaN(n)) return `Semester ${toRoman(n)}`;
  return String(sem);
}

function statusTone(approval?: Syllabus["approval_status"]) {
  switch (approval) {
    case "approved":
      return { bg: "bg-primary-container", text: "text-on-primary", ring: "ring-primary/30", label: "Approved" };
    case "pending":
      return { bg: "bg-secondary-container", text: "text-on-secondary", ring: "ring-secondary/30", label: "Pending review" };
    case "rejected":
      return { bg: "bg-error-container", text: "text-on-error", ring: "ring-error/30", label: "Rejected" };
    default:
      return { bg: "bg-surface-container-high", text: "text-on-surface-variant", ring: "ring-outline-variant/40", label: "Unknown status" };
  }
}

const PROGRAMME_COLORS: Record<string, string> = {
  FYUGP: "#3b82f6",
  NEP: "#f59e0b",
  HONOURS: "#8b5cf6",
};

function programmeAccentColor(programme?: string): string {
  if (!programme) return "var(--color-primary)";
  const upper = programme.toUpperCase();
  if (upper.includes("FYUG")) return PROGRAMME_COLORS.FYUGP;
  for (const [key, color] of Object.entries(PROGRAMME_COLORS)) {
    if (upper.includes(key)) return color;
  }
  return "var(--color-primary)";
}

function programmeBadgeStyle(programme?: string): CSSProperties {
  if (!programme) return { background: "var(--color-border)", color: "var(--color-text-muted)" };
  const upper = programme.toUpperCase();
  if (upper.includes("FYUG")) return { background: "#dbeafe", color: "#1d4ed8" };
  if (upper.includes("NEP")) return { background: "#fef3c7", color: "#92400e" };
  if (upper.includes("HONOURS")) return { background: "#ede9fe", color: "#5b21b6" };
  return { background: "var(--color-border)", color: "var(--color-text-muted)" };
}

function SyllabusPdfCard({
  s,
  isAdmin,
  onHide,
}: {
  s: Syllabus;
  isAdmin?: boolean;
  onHide?: (id: string) => void;
}) {
  const [hiding, setHiding] = useState(false);

  async function handleHide() {
    if (!confirm("Hide this syllabus PDF from public view? It can be restored from the admin panel.")) return;
    setHiding(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hide-syllabus", id: s.id }),
      });
      const data = await res.json();
      if (data.success) {
        onHide?.(s.id);
      } else {
        alert(data.error ?? "Action failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setHiding(false);
    }
  }

  const displayTitle = s.course_name || s.subject || "Unnamed Syllabus";
  const displayCode = s.course_code;
  const submittedOn = s.created_at
    ? new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const tone = statusTone(s.approval_status);

  return (
    <div className="relative group overflow-hidden rounded-3xl border border-outline-variant/30 bg-surface shadow-lift ring-1 ring-surface-container-high/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-ambient">
      <div
        className="h-1 w-full"
        style={{ background: makeAccentGradient(programmeAccentColor(s.programme)) }}
        aria-hidden="true"
      />

      <a
        href={s.file_url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-col gap-3 p-4 sm:p-5"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {s.programme && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={programmeBadgeStyle(s.programme)}
              >
                {s.programme}
              </span>
            )}
            {displayCode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {displayCode}
              </span>
            )}
            {s.approval_status && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
              >
                {tone.label}
              </span>
            )}
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-container-high text-sm font-semibold text-primary ring-1 ring-outline-variant/40">
            {s.year && s.year > 0 ? s.year : "PDF"}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-base font-semibold leading-snug text-on-surface line-clamp-2">{displayTitle}</p>
          <p className="text-sm text-on-surface-variant line-clamp-1">
            {[s.university || "Unknown University", s.semester ? semLabel(s.semester) : null, s.department || null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold text-on-surface-variant">
          {s.course_name && s.course_name !== displayTitle && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.course_name}
            </span>
          )}
          {s.subject && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.subject}
            </span>
          )}
          {s.department && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
              {s.department}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-3">
            {submittedOn && (
              <span className="inline-flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {submittedOn}
              </span>
            )}
            {s.uploaded_by_username && (
              <span className="inline-flex items-center gap-1 truncate max-w-[140px]" title={`@${s.uploaded_by_username}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z" /><path d="M3 21c0-3.866 3.134-7 7-7h4c3.866 0 7 3.134 7 7" />
                </svg>
                @{s.uploaded_by_username}
              </span>
            )}
          </div>

          {s.file_url && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform duration-150 group-hover:translate-x-0.5">
              Open PDF
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
          )}
        </div>
      </a>

      {isAdmin && (
        <button
          type="button"
          title="Hide this syllabus from public view"
          disabled={hiding}
          onClick={handleHide}
          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "#6b7280", color: "#fff" }}
        >
          {hiding ? "…" : "Hide"}
        </button>
      )}
    </div>
  );
}

export default function SyllabusClient({ syllabi, isAdmin }: SyllabusClientProps) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleSyllabi = syllabi.filter(
    (s) => !hiddenIds.has(s.id) && !(s.programme || "").toUpperCase().includes("CBCS"),
  );

  const isDeptSyllabus = (s: Syllabus) => !s.semester || s.semester === "";
  const deptSyllabi = visibleSyllabi.filter(isDeptSyllabus);
  const singleSyllabi = visibleSyllabi.filter((s) => !isDeptSyllabus(s));

  function handleHide(id: string) {
    setHiddenIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-5 ring-1 ring-surface-container-high/40 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Syllabus hub</p>
            <h1 className="mt-1 text-2xl font-semibold text-on-surface sm:text-3xl">Syllabus Explorer</h1>
            <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
              Discover approved syllabus PDFs and structured paper-wise syllabus data with expressive Material 3 styling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              PDFs {visibleSyllabi.length}
            </span>
          </div>
        </div>
      </section>

      <div role="region" aria-label="Available Syllabus PDFs" className="mt-2 space-y-8">
        {deptSyllabi.length > 0 && (
          <div>
            <h2 className="mb-1 flex items-center gap-2 border-b border-outline-variant/40 pb-2 text-base font-semibold text-on-surface">
              <span className="text-primary">Departmental Syllabus</span>
              <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
                {deptSyllabi.length}
              </span>
            </h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              Full programme syllabi covering all semesters (e.g. Physics FYUG Full Syllabus).
            </p>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {deptSyllabi.map((s) => (
                <SyllabusPdfCard key={s.id} s={s} isAdmin={isAdmin} onHide={handleHide} />
              ))}
            </div>
          </div>
        )}

        {singleSyllabi.length > 0 ? (
          <div>
            {deptSyllabi.length > 0 && (
              <h2 className="mb-1 flex items-center gap-2 border-b border-outline-variant/40 pb-2 text-base font-semibold text-on-surface">
                <span className="text-primary">Semester Syllabi</span>
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-normal text-on-surface-variant">
                  {singleSyllabi.length}
                </span>
              </h2>
            )}
            <div
              className="grid gap-4 mt-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {singleSyllabi.map((s) => (
                <SyllabusPdfCard key={s.id} s={s} isAdmin={isAdmin} onHide={handleHide} />
              ))}
            </div>
          </div>
        ) : (
          deptSyllabi.length === 0 && (
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
          )
        )}
      </div>
    </div>
  );
}

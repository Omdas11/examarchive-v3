"use client";

import { useMemo, useState } from "react";
import {
  FELLOWSHIPS,
  FELLOWSHIPS_LAST_VERIFIED,
  type Fellowship,
  type FellowshipSection,
} from "@/data/fellowships";

type Filter = "all" | FellowshipSection;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "research", label: "Research Fellowships" },
  { key: "scholarship", label: "Scholarships" },
];

type Status = "open" | "closed" | "check";

function getStatus(f: Fellowship, today: string): { status: Status; daysLeft: number | null } {
  if (!f.deadline) return { status: "check", daysLeft: null };
  const daysLeft = Math.ceil(
    (new Date(`${f.deadline}T23:59:59+05:30`).getTime() - new Date(`${today}T00:00:00+05:30`).getTime()) /
      86400000,
  );
  return daysLeft >= 0 ? { status: "open", daysLeft } : { status: "closed", daysLeft: null };
}

function sortFellowships(list: Fellowship[], today: string): Fellowship[] {
  const rank: Record<Status, number> = { open: 0, check: 1, closed: 2 };
  return [...list].sort((a, b) => {
    const sa = getStatus(a, today);
    const sb = getStatus(b, today);
    if (rank[sa.status] !== rank[sb.status]) return rank[sa.status] - rank[sb.status];
    if (sa.status === "open" && sb.status === "open") return (a.deadline ?? "").localeCompare(b.deadline ?? "");
    if (sa.status === "closed" && sb.status === "closed") return (b.deadline ?? "").localeCompare(a.deadline ?? "");
    return a.name.localeCompare(b.name);
  });
}

function StatusPill({ status, daysLeft }: { status: Status; daysLeft: number | null }) {
  if (status === "open") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={{ color: "#047857", background: "color-mix(in srgb, #059669 14%, var(--color-surface))" }}
      >
        Open{daysLeft !== null ? ` · ${daysLeft === 0 ? "last day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}` : ""}
      </span>
    );
  }
  if (status === "closed") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={{ color: "var(--color-text-muted)", background: "color-mix(in srgb, var(--color-text-muted) 12%, var(--color-surface))" }}
      >
        Closed
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ color: "#b45309", background: "color-mix(in srgb, #d97706 14%, var(--color-surface))" }}
    >
      Check portal
    </span>
  );
}

function FellowshipCard({ f, today }: { f: Fellowship; today: string }) {
  const { status, daysLeft } = getStatus(f, today);
  return (
    <article
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="material-symbols-outlined mt-0.5 shrink-0"
          style={{ color: f.section === "research" ? "#047857" : "#0369a1" }}
          aria-hidden="true"
        >
          {f.section === "research" ? "school" : "workspace_premium"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-sm font-semibold leading-snug" style={{ color: "var(--color-text)" }}>
            {f.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{
                color: f.section === "research" ? "#047857" : "#0369a1",
                background:
                  f.section === "research"
                    ? "color-mix(in srgb, #059669 12%, var(--color-surface))"
                    : "color-mix(in srgb, #0284c7 12%, var(--color-surface))",
              }}
            >
              {f.provider}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ color: "var(--color-text-muted)", background: "color-mix(in srgb, var(--color-text-muted) 10%, var(--color-surface))" }}
            >
              {f.level}
            </span>
            <StatusPill status={status} daysLeft={daysLeft} />
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text)" }}>
            <span className="material-symbols-outlined shrink-0 text-base" style={{ color: "#047857" }} aria-hidden="true">
              payments
            </span>
            <span>{f.amount}</span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {f.eligibility}
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            <span className="material-symbols-outlined shrink-0 text-sm" aria-hidden="true">
              calendar_month
            </span>
            <span>
              {f.deadlineLabel}
              {f.note ? ` — ${f.note}` : ""}
            </span>
          </p>
          <a
            href={f.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold no-underline"
            style={{ color: "#ffffff", background: "#047857" }}
          >
            Apply on the official site
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              open_in_new
            </span>
          </a>
        </div>
      </div>
    </article>
  );
}

function GroupHeading({ children }: { children: string }) {
  return (
    <h2 className="mt-8 text-base font-bold first:mt-0" style={{ color: "var(--color-text)" }}>
      {children}
    </h2>
  );
}

export default function FellowshipsClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const openCount = useMemo(
    () => FELLOWSHIPS.filter((f) => getStatus(f, today).status === "open").length,
    [today],
  );

  const research = useMemo(
    () => sortFellowships(FELLOWSHIPS.filter((f) => f.section === "research"), today),
    [today],
  );
  const national = research.filter((f) => f.group === "national");
  const institutions = research.filter((f) => f.group === "institutions");
  const scholarships = useMemo(
    () => sortFellowships(FELLOWSHIPS.filter((f) => f.section === "scholarship"), today),
    [today],
  );

  const showResearch = filter === "all" || filter === "research";
  const showScholarships = filter === "all" || filter === "scholarship";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{
                borderColor: active ? "#047857" : "var(--color-border)",
                color: active ? "#ffffff" : "var(--color-text)",
                background: active ? "#047857" : "var(--color-surface)",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ color: "#047857", background: "color-mix(in srgb, #059669 12%, var(--color-surface))" }}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            check_circle
          </span>
          {openCount} open now
        </span>
      </div>

      {showResearch && (
        <>
          <GroupHeading>Research Fellowships</GroupHeading>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            National fellowships for PhD research, and PhD admissions at the
            top institutions. Most of these need a Master&apos;s degree and a
            qualifying exam (NET, GATE or JEST).
          </p>

          <h3 className="mt-5 text-sm font-bold" style={{ color: "var(--color-text)" }}>
            National fellowships
          </h3>
          <div className="mt-3 flex flex-col gap-3">
            {national.map((f) => (
              <FellowshipCard key={f.id} f={f} today={today} />
            ))}
          </div>

          <h3 className="mt-6 text-sm font-bold" style={{ color: "var(--color-text)" }}>
            PhD admissions — top institutions
          </h3>
          <div
            className="mt-3 rounded-lg border p-3 text-xs leading-relaxed"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
          >
            IITs run separate PhD calls per institute — most January 2027
            rounds closed in Oct–Nov 2026. IIT Guwahati&apos;s open round
            (till 6 Dec 2026) is for international students only.{" "}
            <a
              href="https://www.iitg.ac.in/admission-fr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#047857", fontWeight: 700 }}
            >
              IIT Guwahati international portal
            </a>
            .
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {institutions.map((f) => (
              <FellowshipCard key={f.id} f={f} today={today} />
            ))}
          </div>
        </>
      )}

      {showScholarships && (
        <>
          <GroupHeading>Scholarships</GroupHeading>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            For undergraduate students — including two that are open right now.
            Ishan Uday is only for students from the North East.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {scholarships.map((f) => (
              <FellowshipCard key={f.id} f={f} today={today} />
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Deadlines checked against the official portals on{" "}
        {FELLOWSHIPS_LAST_VERIFIED}. Dates change and extensions happen —
        always confirm on the official site before applying, and never pay an
        agent to apply for you. New fellowships are added here when their
        calls open.
      </p>
    </div>
  );
}

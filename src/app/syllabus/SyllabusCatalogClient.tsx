"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Syllabus } from "@/types";
import {
  FEATURED_PAPERS,
  formatTwoDigits,
  getMentorInitials,
} from "@/data/featured-curriculum";
import { SYLLABUS_REGISTRY } from "@/data/syllabus-registry";
import SyllabusClient from "./SyllabusClient";

const DEPARTMENT_FILTERS = ["All Departments", "Science", "Arts"];

const CARD_META: Record<
  string,
  { icon: string; accent: string; badge?: string; year?: string; university?: string; verified?: boolean }
> = {
  "PH-101": { icon: "🧪", accent: "bg-indigo-100", badge: "CORE ELECTIVE", year: "2023-24", university: "Assam University" },
  "PH-102": { icon: "💻", accent: "bg-emerald-100", badge: "IN DEMAND", year: "2024-25", university: "Assam University", verified: true },
  "MA-101": { icon: "📐", accent: "bg-amber-100", year: "2022-23", university: "Assam University" },
  "SK-101": { icon: "📘", accent: "bg-slate-100", year: "2024-25", university: "Assam University" },
};

function paperExists(code?: string) {
  if (!code) return false;
  return SYLLABUS_REGISTRY.some((entry) => entry.paper_code.toUpperCase() === code.toUpperCase());
}

function MentorGroup({ mentors }: { mentors: string[] }) {
  const initials = mentors.map(getMentorInitials).filter(Boolean);
  const visible = initials.slice(0, 2);
  const remaining = Math.max(0, initials.length - visible.length);

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((m, idx) => (
          <span
            key={`${m}-${idx}`}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ring-2 ring-surface shadow-sm",
              idx === 0 ? "bg-primary/10 text-primary" : "bg-secondary/20 text-secondary",
            )}
          >
            {m}
          </span>
        ))}
      </div>
      {remaining > 0 && (
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">+{remaining}</span>
      )}
    </div>
  );
}

function FeaturedCard({
  code,
  title,
  credits,
  units,
  mentors,
  registryCode,
}: typeof FEATURED_PAPERS[number]) {
  const meta = CARD_META[code] ?? { icon: "📄", accent: "bg-surface-container" };
  const hasRegistry = paperExists(registryCode);
  const href = hasRegistry && registryCode ? `/syllabus/paper/${registryCode}` : undefined;

  return (
    <article className="rounded-[32px] border border-outline-variant/30 bg-surface p-5 shadow-xl shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl text-3xl", meta.accent)} aria-hidden="true">
          <span>{meta.icon}</span>
        </div>
        {meta.badge && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-700">
            {meta.badge}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="text-2xl font-semibold text-on-surface">{title}</h3>
        <p className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-base align-middle">location_city</span>
          {meta.university ?? "Assam University"}
          <span className="text-on-surface-variant/60">•</span>
          <span>{meta.year ?? "2024-25"}</span>
        </p>
      </div>

      {meta.verified && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-sm">verified</span>
          Verified by Faculty
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm text-on-surface-variant">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">star</span>
            <span className="font-semibold text-on-surface">{formatTwoDigits(credits)}</span>
            <span className="text-xs text-on-surface-variant/70">Credits</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-base">grid_view</span>
            <span className="font-semibold text-on-surface">{formatTwoDigits(units)}</span>
            <span className="text-xs text-on-surface-variant/70">Units</span>
          </div>
        </div>
        <MentorGroup mentors={mentors} />
      </div>

      <div className="mt-5 flex justify-end">
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30"
          >
            Open PDF
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-2xl bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface-variant">
            Open PDF
            <span className="material-symbols-outlined text-base">lock</span>
          </span>
        )}
      </div>
    </article>
  );
}

export default function SyllabusCatalogClient({ syllabi, isAdmin }: { syllabi: Syllabus[]; isAdmin?: boolean }) {
  const [activeTab, setActiveTab] = useState<"pdfs" | "library">("pdfs");
  const [activeFilter, setActiveFilter] = useState(DEPARTMENT_FILTERS[0]);

  const filteredFeatured = useMemo(() => {
    if (activeFilter === "All Departments") return FEATURED_PAPERS;
    if (activeFilter === "Science") return FEATURED_PAPERS.filter((p) => p.tag !== "SEC");
    if (activeFilter === "Arts") return FEATURED_PAPERS.filter((p) => p.tag === "SEC");
    return FEATURED_PAPERS;
  }, [activeFilter]);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6">
      <div className="space-y-8 rounded-[32px] bg-gradient-to-b from-surface to-surface-container-low p-2 shadow-inner shadow-primary/5">
        <header className="space-y-3 rounded-[24px] bg-surface p-6 shadow-sm shadow-primary/5">
          <h1 className="text-4xl font-black leading-tight text-on-surface">Syllabus Catalog</h1>
          <p className="max-w-2xl text-base text-on-surface-variant">
            Access verified curriculum and exam structures for your department.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-2 text-sm font-semibold shadow-inner">
            <button
              className={cn(
                "rounded-xl px-3 py-3 transition",
                activeTab === "pdfs"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-on-surface-variant hover:bg-surface",
              )}
              onClick={() => setActiveTab("pdfs")}
            >
              Available Syllabus PDFs
            </button>
            <button
              className={cn(
                "rounded-xl px-3 py-3 transition",
                activeTab === "library"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-on-surface-variant hover:bg-surface",
              )}
              onClick={() => setActiveTab("library")}
            >
              Paper Syllabus Library
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENT_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition shadow-sm",
                  activeFilter === filter
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-on-surface-variant hover:bg-surface-container",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "pdfs" ? (
          <div className="space-y-5">
            {filteredFeatured.map((paper) => (
              <FeaturedCard key={paper.code} {...paper} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl bg-surface p-4 shadow-sm shadow-primary/5">
            <SyllabusClient syllabi={syllabi} isAdmin={isAdmin} />
          </div>
        )}
      </div>
    </section>
  );
}

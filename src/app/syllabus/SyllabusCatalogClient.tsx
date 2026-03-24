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
  "PH-101": {
    icon: "science",
    accent: "bg-[#ebe8ff] text-[#3c2fd6]",
    badge: "CORE ELECTIVE",
    year: "2023-24",
    university: "Assam University",
  },
  "PH-102": {
    icon: "computer",
    accent: "bg-[#e4f5ef] text-[#1f8a63]",
    badge: "IN DEMAND",
    year: "2024-25",
    university: "Assam University",
    verified: true,
  },
  "MA-101": { icon: "calculate", accent: "bg-[#f3ecdf] text-[#c1842c]", year: "2022-23", university: "Assam University" },
  "SK-101": { icon: "menu_book", accent: "bg-[#e5f1ff] text-[#2b6cb0]", year: "2024-25", university: "Assam University" },
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
        {visible.map((m, idx) => {
          const tone =
            idx === 0
              ? "bg-primary text-primary-foreground"
              : idx === 1
                ? "bg-amber-500 text-white"
                : "bg-surface-container text-on-surface";
          return (
            <span
              key={`${m}-${idx}`}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-surface shadow-sm",
                tone,
              )}
            >
              {m}
            </span>
          );
        })}
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
  const meta = CARD_META[code] ?? { icon: "description", accent: "bg-surface-container text-primary" };
  const hasRegistry = paperExists(registryCode);
  const href = hasRegistry && registryCode ? `/syllabus/paper/${registryCode}` : undefined;

  return (
    <article className="rounded-[32px] border border-surface-container-high/30 bg-gradient-to-b from-surface to-surface-container-low shadow-xl shadow-primary/10 ring-1 ring-primary/5">
      <div className="grid grid-cols-[auto_1fr] gap-4 p-6 md:p-7">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-[0_10px_24px_-12px_rgba(0,0,0,0.25)]",
            meta.accent,
          )}
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-3xl">{meta.icon}</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl font-semibold text-on-surface">{title}</h3>
            {meta.badge && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-700 shadow-inner">
                {meta.badge}
              </span>
            )}
          </div>

          <p className="flex items-center gap-2 text-base font-medium text-on-surface-variant">
            <span className="material-symbols-outlined text-lg">apartment</span>
            {meta.university ?? "Assam University"}
            <span className="text-on-surface-variant/60">•</span>
            <span>{meta.year ?? "2024-25"}</span>
          </p>

          {meta.verified && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-sm">verified</span>
              Verified by Faculty
            </div>
          )}

          <div className="flex items-center gap-6 text-sm text-on-surface-variant">
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
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-outline-variant/40 px-6 py-5 md:px-7">
        <MentorGroup mentors={mentors} />
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#3c2fd6] px-7 py-3 text-base font-semibold text-white shadow-lg shadow-primary/30 transition hover:translate-y-[-1px] hover:shadow-primary/40"
          >
            Open PDF
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-2xl bg-surface-container px-7 py-3 text-base font-semibold text-on-surface-variant">
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
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <div className="space-y-8 rounded-[36px] bg-gradient-to-b from-surface to-surface-container-lowest p-5 shadow-inner shadow-primary/5 ring-1 ring-primary/5">
        <header className="space-y-5 rounded-[28px] bg-surface p-6 shadow-sm shadow-primary/10 ring-1 ring-surface-container-high/40">
          <h1 className="text-4xl font-black leading-tight text-on-surface">Syllabus Catalog</h1>
          <p className="max-w-2xl text-base text-on-surface-variant">
            Access verified curriculum and exam structures for your department.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-2 text-sm font-semibold shadow-inner ring-1 ring-surface-container-high/40">
            <button
              className={cn(
                "rounded-xl px-3 py-3 transition",
                activeTab === "pdfs"
                  ? "bg-[#3c2fd6] text-white shadow-lg shadow-primary/30"
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
                  ? "bg-[#3c2fd6] text-white shadow-lg shadow-primary/30"
                  : "text-on-surface-variant hover:bg-surface",
              )}
              onClick={() => setActiveTab("library")}
            >
              Paper Syllabus Library
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {DEPARTMENT_FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition shadow-sm ring-1 ring-transparent",
                  activeFilter === filter
                    ? "bg-[#3c2fd6] text-white shadow-md shadow-primary/30"
                    : "bg-surface-container text-on-surface hover:bg-surface-container-high",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "pdfs" ? (
          <div className="space-y-6">
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

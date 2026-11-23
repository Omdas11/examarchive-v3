import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth-cf";
import { getAllSyllabusRows } from "@/lib/syllabus-cache";
import { getApprovedPapersForTimetable } from "@/lib/timetable-papers";
import { SYLLABUS_DISABLED } from "@/lib/site-flags";
import {
  dedupeSyllabusRowsByUnit,
  normalizePaperCode,
} from "@/lib/syllabus-table";
import { syllabusDeptSlugForPaperCode } from "@/lib/syllabus-departments";
import {
  HGC_EXAM_DATES,
  HGC_EXAM_ITEMS,
} from "@/lib/hgc-exam-timetable";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import ExamTimetableClient, {
  type ExamTimetableSummary,
  type RelatedPaperLink,
  type TimetableLookupEntry,
} from "./ExamTimetableClient";

export const metadata: Metadata = {
  title: "HGC Exam Timetable Nov-Dec 2026 — ExamArchive",
  description:
    "Haflong Government College exam timetable, 21 Nov – 22 Dec 2026 (FYUGP 1st / 3rd / 5th Semester & CBCS Arrear). Every slot shows whether its question paper is on ExamArchive, with links to past papers.",
  alternates: { canonical: "/exam-timetable" },
};

/**
 * Bengali papers are stored under BNG* (e.g. BENDSM201T as BNGDSM201T)
 * and Political Science under PLS* (e.g. POLDSC301T as PLSDSC301T).
 * A timetable code matches a stored code under either spelling.
 */
function aliasVariants(normalizedCode: string): string[] {
  const variants = [normalizedCode];
  if (normalizedCode.startsWith("BEN")) {
    variants.push(`BNG${normalizedCode.slice(3)}`);
  } else if (normalizedCode.startsWith("BNG")) {
    variants.push(`BEN${normalizedCode.slice(3)}`);
  }
  if (normalizedCode.startsWith("POL")) {
    variants.push(`PLS${normalizedCode.slice(3)}`);
  } else if (normalizedCode.startsWith("PLS")) {
    variants.push(`POL${normalizedCode.slice(3)}`);
  }
  return variants;
}

export default async function ExamTimetablePage() {
  const user = await getServerUser();

  // Approved papers come from the 6-hour KV cache (timetable-papers.ts),
  // so a public page view costs ~0 D1 reads. Syllabus rows come from the
  // 7-day KV cache, so usually 0 D1 reads there too.
  let approved: Awaited<ReturnType<typeof getApprovedPapersForTimetable>> =
    [];
  try {
    approved = await getApprovedPapersForTimetable();
  } catch {
    approved = [];
  }

  let syllabusRows: Awaited<ReturnType<typeof getAllSyllabusRows>> = [];
  try {
    syllabusRows = await getAllSyllabusRows();
  } catch {
    syllabusRows = [];
  }

  const papersByCode = new Map<string, RelatedPaperLink[]>();
  for (const paper of approved) {
    const key = normalizePaperCode(paper.course_code);
    if (!key) continue;
    const list = papersByCode.get(key) ?? [];
    list.push({
      id: paper.id,
      paperName: paper.paper_name || paper.course_code,
      year: paper.year,
    });
    papersByCode.set(key, list);
  }

  const syllabusByCode = new Map<
    string,
    Awaited<ReturnType<typeof getAllSyllabusRows>>
  >();
  for (const row of syllabusRows) {
    const key = normalizePaperCode(row.paper_code);
    if (!key) continue;
    const list = syllabusByCode.get(key) ?? [];
    list.push(row);
    syllabusByCode.set(key, list);
  }

  const distinctCodes = [
    ...new Set(
      HGC_EXAM_ITEMS.map((item) => item.canonicalCode).filter(
        (code): code is string => code !== null,
      ),
    ),
  ];

  const lookup: Record<string, TimetableLookupEntry> = {};
  for (const code of distinctCodes) {
    const papersByYear: Record<string, RelatedPaperLink[]> = {};
    for (const variant of aliasVariants(code)) {
      for (const paper of papersByCode.get(variant) ?? []) {
        if (paper.year < 2023 || paper.year > 2026) continue;
        const yearKey = String(paper.year);
        const list = papersByYear[yearKey] ?? [];
        if (!list.some((p) => p.id === paper.id)) list.push(paper);
        papersByYear[yearKey] = list;
      }
    }
    for (const list of Object.values(papersByYear)) {
      list.sort((a, b) => a.paperName.localeCompare(b.paperName));
    }

    const rows: typeof syllabusRows = [];
    for (const variant of aliasVariants(code)) {
      rows.push(...(syllabusByCode.get(variant) ?? []));
    }
    const syllabusUnits = dedupeSyllabusRowsByUnit(rows).length;
    const deptSlug = syllabusDeptSlugForPaperCode(code);
    lookup[code] = {
      papersByYear,
      syllabusUnits,
      // Syllabus pages are disabled site-wide (503) until verified, so
      // never link to them from the public page; the unit count is still
      // shown as plain text.
      syllabusHref:
        !SYLLABUS_DISABLED && deptSlug && syllabusUnits > 0
          ? `/syllabus/paper/${deptSlug}/${code}`
          : null,
    };
  }

  let have = 0;
  let missingByCode = 0;
  let labelOnly = 0;
  for (const item of HGC_EXAM_ITEMS) {
    if (!item.canonicalCode) {
      labelOnly += 1;
      continue;
    }
    const entry = lookup[item.canonicalCode];
    const count = entry
      ? Object.values(entry.papersByYear).reduce(
          (n, list) => n + list.length,
          0,
        )
      : 0;
    if (count > 0) have += 1;
    else missingByCode += 1;
  }
  const summary: ExamTimetableSummary = {
    total: HGC_EXAM_ITEMS.length,
    have,
    missing: HGC_EXAM_ITEMS.length - have,
    missingByCode,
    labelOnly,
  };

  const userName = user ? user.name || user.username || "Scholar" : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <MainLayout
      title="Exam Timetable"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Exam Timetable" },
      ]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "student"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10" style={{ maxWidth: "var(--max-w)" }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Exam Timetable</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Haflong Government College — FYUGP 1st / 3rd / 5th Semester &amp;
            CBCS Arrear, 21 Nov – 22 Dec 2026. Every slot shows whether its
            question paper is already on ExamArchive. Related papers cover
            2023–2026 (FYUG started 2023, so 2026 papers only exist after the
            exam).
          </p>
        </div>

        <ExamTimetableClient
          dates={HGC_EXAM_DATES}
          items={HGC_EXAM_ITEMS}
          lookup={lookup}
          summary={summary}
          todayIso={todayIso}
          syllabusLinksEnabled={!SYLLABUS_DISABLED}
        />
      </section>
    </MainLayout>
  );
}

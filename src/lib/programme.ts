/**
 * Classify a paper's academic programme (CBCS / FYUG / HS) from its course code.
 * Used as a fallback when the `programme` field is not set in the database.
 *
 * Rules for Assam University / Haflong Government College:
 * - HCC / HGE codes → CBCS (Honours Core Course / Honours Generic Elective)
 * - DSC / DSM / AEC / VAC codes → FYUG
 * - FYUG numeric codes (e.g. ECO0300104, SEC0107203) → FYUG
 * - Bare GE (not HGE) → FYUG (FYUG uses DSC/GE pattern)
 * - HES (Honours Elective) → FYUG
 * - SEC / DSE / LAN / GEN → split by year (≤2022 CBCS, ≥2023 FYUG)
 * - HS semester → HS (Higher Secondary, not UG)
 */
export function classifyProgramme(
  courseCode?: string | null,
  year?: number | null,
  semester?: string | null,
): "CBCS" | "FYUGP" | "HS" | null {
  if (semester && /hs/i.test(semester)) return "HS";
  if (!courseCode) return null;
  const c = courseCode.toUpperCase().trim();
  const y = year ?? 0;

  if (/HCC|HGE/.test(c)) return "CBCS";
  if (/DSC|DSM|AEC|VAC/.test(c)) return "FYUGP";
  if (/^[A-Z]{3}\d{7}$/.test(c) || /^SEC\d{7}$/.test(c)) return "FYUGP";
  if (/(?<!H)GE/.test(c)) return "FYUGP";
  if (/HES/.test(c)) return "FYUGP";
  if (/SEC|DSE|LAN|GEN/.test(c)) {
    if (y <= 2022 && y > 0) return "CBCS";
    if (y >= 2023) return "FYUGP";
    return null;
  }
  return null;
}

/** Resolve the display programme, preferring the stored field. */
export function getProgramme(p: {
  programme?: string | null;
  course_code?: string | null;
  year?: number | null;
  semester?: string | null;
}): string | null {
  if (p.programme === "FYUGP" || p.programme === "CBCS") return p.programme;
  if (p.programme) return p.programme; // e.g. "Other" values pass through
  return classifyProgramme(p.course_code, p.year, p.semester);
}

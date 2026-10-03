/**
 * Classify a paper's academic programme (CBCS / FYUGP / HS) from its course code.
 * Used as a fallback when the `programme` field is not set in the database.
 *
 * Conservative approach: only definitive FYUG signals → FYUGP, everything else → CBCS.
 * The collection is majority CBCS (2018-2024); FYUGP started 2022-23 at Assam University.
 *
 * Definitive FYUG signals:
 * - DSC / DSM / AEC / VAC codes with year ≥ 2022
 * - New numeric coding system (e.g. ECO0300104, SEC0107203)
 *
 * Everything else (HCC, HGE, SEC, DSE, LAN, GEN, bare GE) → CBCS.
 * Pre-2022 DSC/AEC codes → CBCS (FYUG didn't exist yet).
 * HS semester → HS (Higher Secondary, not UG).
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

  // Definitive FYUG: DSC/DSM/AEC/VAC codes from the FYUG era (2022+)
  if (/DSC|DSM|AEC|VAC/.test(c)) {
    return y >= 2022 ? "FYUGP" : "CBCS";
  }
  // Definitive FYUG: new numeric coding system
  if (/^[A-Z]{3}\d{7}$/.test(c) || /^SEC\d{7}$/.test(c)) {
    return "FYUGP";
  }
  // Everything else → CBCS (HCC, HGE, SEC, DSE, LAN, GEN, bare GE)
  return "CBCS";
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

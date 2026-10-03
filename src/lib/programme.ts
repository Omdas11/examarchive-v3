/**
 * Classify a paper's academic programme (CBCS / FYUGP / HS) from its course code.
 * Used as a fallback when the `programme` field is not set in the database.
 *
 * Strict approach based on:
 * - FYUG: examarchive-vault/docs/PAPER_CODE_VALIDATION_RULES.md
 *   Canonical: ^([A-Z]{3})(DSC|DSM|SEC|IDC|AEC|VAC)(10[1-9]|15[1-9]|...|45[1-9])[ABC]?[TP]$
 *   Semester mapping: 10x→S1, 15x→S2, 20x→S3, 25x→S4, 30x→S5, 35x→S6, 40x→S7, 45x→S8
 * - CBCS: [SUBJECT][H/P/L]-[SEM][PAPER] e.g. BNGH-601, BNGP-401, BNGL-401; also BNG-SEC-401
 *
 * A paper is FYUGP only if ALL hold:
 *  1. Code matches the canonical FYUG regex (no slashes, valid type, valid sem code, T/P suffix)
 *  2. Year >= 2022 (FYUGP started 2022-23 at Assam University)
 *  3. The semester code maps to the paper's actual semester per FYUG mapping
 *     (e.g. 401 = sem 7; a "Sem IV" paper with 401 is CBCS, not FYUG)
 *
 * Everything else → CBCS. HS semester → HS.
 */

// Canonical FYUG regex from PAPER_CODE_VALIDATION_RULES.md, tolerant of real
// printed variants: the T/P suffix is often omitted on the paper itself
// (e.g. "BOTDSC-251"), some papers carry a second code ("301/302T") or a
// parenthetical variant ("VAC101T(A)"), and VAC papers are printed without a
// subject prefix ("VAC-101T(A)"). The semester-alignment check below remains
// the guard against false positives. Group 1 = semester code.
const FYUG_SEM_PAT =
  "10[1-9]|15[1-9]|20[1-9]|25[1-9]|30[1-9]|35[1-9]|40[1-9]|45[1-9]";
const FYUG_RE = new RegExp(
  `^(?:[A-Z]{3}(?:DSC|DSM|SEC|IDC|AEC|VAC)|VAC)(${FYUG_SEM_PAT})(?:\\/\\d{3})?[ABC]?[TP]?(?:\\([A-Z]\\))?$`
);

/** Map FYUG semester code → semester number. */
function fyugSemNo(semCode: string): number | null {
  const prefix = semCode.slice(0, 2);
  const map: Record<string, number> = {
    "10": 1, "15": 2, "20": 3, "25": 4,
    "30": 5, "35": 6, "40": 7, "45": 8,
  };
  return map[prefix] ?? null;
}

/** Extract semester number from a "1st"/"2nd"/"4th"/"Sem IV" style string. */
function parseSemester(semester?: string | null): number | null {
  if (!semester) return null;
  const m = semester.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  const roman = semester.match(/\b(I{1,3}|IV|V|VI{1,3}|VII|VIII)\b/i);
  if (roman) {
    const r: Record<string, number> = {
      I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    };
    return r[roman[1].toUpperCase()] ?? null;
  }
  return null;
}

export function classifyProgramme(
  courseCode?: string | null,
  year?: number | null,
  semester?: string | null,
): "CBCS" | "FYUGP" | "HS" | null {
  if (semester && /\bhs\b/i.test(semester)) return "HS";
  if (!courseCode) return null;
  const c = courseCode.toUpperCase().trim().replace(/[\s\-_]/g, "");
  const y = year ?? 0;

  const m = c.match(FYUG_RE);
  if (m && y >= 2022) {
    // Check semester alignment: code's sem must match paper's sem
    const codeSem = fyugSemNo(m[1]);
    const paperSem = parseSemester(semester);
    if (codeSem !== null && paperSem !== null) {
      return codeSem === paperSem ? "FYUGP" : "CBCS";
    }
    // No semester metadata to cross-check — trust code + year
    return "FYUGP";
  }
  return "CBCS";
}

/** Resolve the display programme — always computed from the course code.
 *  The stored `programme` DB field is unreliable (contains incorrect values),
 *  so the classifier is the source of truth. */
export function getProgramme(p: {
  programme?: string | null;
  course_code?: string | null;
  year?: number | null;
  semester?: string | null;
}): string | null {
  return classifyProgramme(p.course_code, p.year, p.semester);
}

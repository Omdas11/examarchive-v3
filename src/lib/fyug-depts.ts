/**
 * Canonical department codes for the NEP 2020 FYUG programme at
 * Haflong Government College (Assam University).
 *
 * These codes are the 3-letter prefixes used in markdown filenames and paper codes,
 * e.g., PHYDSC101T (PHY), COMDSC101T (COM).
 *
 * The 13 HGC departments are: Physics (PHY), Chemistry (CHE/CHM — two code
 * aliases), Zoology (ZOO), Botany (BOT), Mathematics (MAT), Commerce (COM),
 * English (ENG), Economics (ECO), Bengali (BEN), Assamese (ASM),
 * Political Science (PLS), History (HIS), Philosophy (PHI).
 *
 * NOTE: "COM" is Commerce at HGC — there is no Computer Science department.
 */
export const FYUG_DEPT_CODES = new Set([
  "PHY", // Physics
  "CHE", // Chemistry
  "CHM", // Chemistry (alternative code)
  "ZOO", // Zoology
  "BOT", // Botany
  "MAT", // Mathematics
  "COM", // Commerce (Haflong Government College department)
  "ENG", // English
  "ECO", // Economics
  "BEN", // Bengali
  "ASM", // Assamese
  "PLS", // Political Science
  "HIS", // History
  "PHI", // Philosophy
] as const);

export type FyugDeptCode = typeof FYUG_DEPT_CODES extends Set<infer T> ? T : never;

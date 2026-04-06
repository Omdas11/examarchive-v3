/**
 * Canonical 13 department codes for the NEP 2020 FYUG programme at
 * Haflong Government College (Assam University).
 *
 * These codes are the 3-letter prefixes used in markdown filenames and paper codes,
 * e.g., PHYDSC101T (PHY), MATDSC401AT (MAT).
 */
export const FYUG_DEPT_CODES = new Set([
  "PHY", // Physics
  "CHM", // Chemistry
  "ZOO", // Zoology
  "BOT", // Botany
  "MAT", // Mathematics
  "COM", // Computer Science
  "ENG", // English
  "ECO", // Economics
  "BEN", // Bengali
  "ASM", // Assamese
  "PLS", // Political Science
  "HIS", // History
  "PHI", // Philosophy
] as const);

export type FyugDeptCode = typeof FYUG_DEPT_CODES extends Set<infer T> ? T : never;

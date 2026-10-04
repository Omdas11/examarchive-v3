import fs from "node:fs";
import path from "node:path";

const PROMPTS_DIR = path.join(
  process.cwd(),
  "appwrite-functions",
  "pdf-generator",
  "prompts",
);

const DEPARTMENT_PREFIX_MAP: Record<string, string> = {
  PHY: "physics",
  PHS: "physics",
  CHM: "chemistry",
  MAT: "mathematics",
  MTM: "mathematics",
  BNG: "bengali",
  ENG: "english",
  ASM: "assamese",
  BOT: "botany",
  ZOO: "zoology",
  COM: "commerce",
  ECO: "economics",
  HIS: "history",
  PHI: "philosophy",
  POL: "political-science",
  PLS: "political-science",
};

export function resolveDepartmentSlug(paperCode: string | undefined | null): string {
  const prefix = String(paperCode ?? "").trim().toUpperCase().slice(0, 3);
  return DEPARTMENT_PREFIX_MAP[prefix] ?? "";
}

const cache = new Map<string, string>();

function readPromptFile(name: string): string {
  if (cache.has(name)) return cache.get(name)!;
  let text = "";
  try {
    text = fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), "utf8");
  } catch {
    text = "";
  }
  cache.set(name, text);
  return text;
}

/**
 * Core exam-notes format + department style guide, resolved from paper code.
 * Falls back to empty string (caller uses its own default prompt then).
 */
export function getDepartmentPrompt(paperCode: string | undefined | null): string {
  const core = readPromptFile("_core");
  const slug = resolveDepartmentSlug(paperCode);
  const dept = slug ? readPromptFile(slug) : "";
  return [core, dept].filter(Boolean).join("\n\n");
}

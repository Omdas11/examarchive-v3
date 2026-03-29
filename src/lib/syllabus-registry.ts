import fs from "fs";
import path from "path";

export interface SyllabusRegistryRecord {
  paper_code: string;
  paper_name: string;
  semester: string;
  subject: string;
  credits: string;
  programme: string;
  university: string;
  category?: string;
}

const REGISTRY_MD_PATH = path.resolve(process.cwd(), "docs/SYLLABUS_REGISTRY.md");
let cache: SyllabusRegistryRecord[] | null = null;
let cacheMtime = 0;

function parseMarkdownTable(md: string): SyllabusRegistryRecord[] {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 2) return [];

  const header = lines[0]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const records: SyllabusRegistryRecord[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx) => idx !== 0 && idx !== lines[i].split("|").length - 1);
    if (cols.length === 0) continue;

    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cols[idx] ?? "";
    });

    if (row.paper_code) {
      records.push({
        paper_code: row.paper_code,
        paper_name: row.paper_name ?? "",
        semester: row.semester ?? "",
        subject: row.subject ?? "",
        credits: row.credits ?? "",
        programme: row.programme ?? "",
        university: row.university ?? "",
        category: row.category ?? "",
      });
    }
  }
  return records;
}

export async function loadSyllabusRegistry(): Promise<SyllabusRegistryRecord[]> {
  const stat = fs.statSync(REGISTRY_MD_PATH);
  if (cache && cacheMtime === stat.mtimeMs) return cache;
  const md = fs.readFileSync(REGISTRY_MD_PATH, "utf8");
  cache = parseMarkdownTable(md);
  cacheMtime = stat.mtimeMs;
  return cache;
}

export async function findRegistryEntry(code: string): Promise<SyllabusRegistryRecord | undefined> {
  const entries = await loadSyllabusRegistry();
  const upper = code.toUpperCase();
  return entries.find((e) => e.paper_code.toUpperCase() === upper);
}

export async function listUniversities(): Promise<string[]> {
  const entries = await loadSyllabusRegistry();
  return Array.from(new Set(entries.map((e) => e.university).filter(Boolean))).sort();
}


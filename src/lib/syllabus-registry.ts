import * as fs from "fs";
import path from "path";

export interface SyllabusRegistryRecord {
  paper_code: string;
  paper_name: string;
  semester: number | null;
  subject: string;
  credits: number | null;
  programme: string;
  university: string;
  category?: string;
  contact_hours?: number | null;
  full_marks?: number | null;
  // Preserve any additional columns so the API can expose them as-is.
  [key: string]: string | number | null | undefined;
}

const REGISTRY_MD_PATH = path.resolve(process.cwd(), "docs/SYLLABUS_REGISTRY.md");
let cache: SyllabusRegistryRecord[] | null = null;
let cacheMtime = 0;

function parseMarkdownTable(md: string): SyllabusRegistryRecord[] {
  if (!md) return [];

  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));

  if (lines.length < 2) return [];

  const header = lines[0]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const numericFields = new Set(["semester", "credits", "contact_hours", "full_marks"]);

  const records: SyllabusRegistryRecord[] = [];
  for (let i = 2; i < lines.length; i++) {
    const segments = lines[i].split("|").map((c) => c.trim());
    if (segments[0] === "") segments.shift();
    if (segments[segments.length - 1] === "") segments.pop();
    const cols = segments;
    if (cols.length === 0) continue;

    const row: Record<string, string | number | null | undefined> = {};
    header.forEach((key, idx) => {
      const raw = cols[idx] ?? "";
      if (numericFields.has(key)) {
        if (raw === "" || raw === "-") {
          row[key] = null;
        } else {
          const n = Number(raw);
          row[key] = Number.isFinite(n) ? n : null;
        }
      } else {
        row[key] = raw === "-" ? "" : raw;
      }
    });

    if (row.paper_code) {
      records.push({
        paper_code: String(row.paper_code),
        paper_name: String(row.paper_name ?? ""),
        semester: (row.semester as number | null) ?? null,
        subject: String(row.subject ?? ""),
        credits: (row.credits as number | null) ?? null,
        programme: String(row.programme ?? ""),
        university: String(row.university ?? ""),
        category: (row.category as string | undefined) ?? undefined,
        contact_hours: (row.contact_hours as number | null) ?? undefined,
        full_marks: (row.full_marks as number | null) ?? undefined,
        ...row,
      });
    }
  }
  return records;
}

export async function loadSyllabusRegistry(): Promise<SyllabusRegistryRecord[]> {
  const stat = fs.statSync(REGISTRY_MD_PATH);
  const mtime = stat?.mtimeMs ?? 0;
  if (cache && cacheMtime === mtime) return cache;
  const md = fs.readFileSync(REGISTRY_MD_PATH, "utf8");
  cache = parseMarkdownTable(md);
  cacheMtime = mtime;
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

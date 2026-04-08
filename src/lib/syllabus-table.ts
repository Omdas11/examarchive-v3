export interface SyllabusTableRow {
  id: string;
  entry_id?: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paper_code: string;
  paper_name: string;
  subject: string;
  unit_number: number;
  syllabus_content: string;
  lectures?: number;
  tags: string[];
}

export interface SyllabusTablePaperSummary {
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  paperName: string;
  subject: string;
  subjectCode: string;
  credits?: number;
  units: number;
  lectures: number;
  questionPapers: Array<{
    paperId: string;
    year: number;
    examType?: string;
  }>;
}

export const PAPER_NAME_SPLIT_RE = /[.;\n]/;

export function extractSubjectCode(paperCode: string): string {
  const upper = paperCode.trim().toUpperCase();
  if (!upper) return "GEN";
  const alphaPrefix = upper.match(/[A-Z]+/)?.[0] ?? "";
  if (alphaPrefix.length >= 3) return alphaPrefix.slice(0, 3);
  if (alphaPrefix.length > 0) return alphaPrefix;
  return "GEN";
}

export function toSyllabusTableRow(doc: Record<string, unknown>): SyllabusTableRow {
  const tags = Array.isArray(doc.tags)
    ? doc.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    id: String(doc.$id ?? doc.id ?? ""),
    entry_id: typeof doc.entry_id === "string" && doc.entry_id.trim().length > 0 ? doc.entry_id.trim() : undefined,
    university: String(doc.university ?? ""),
    course: String(doc.course ?? ""),
    stream: String(doc.stream ?? ""),
    type: String(doc.type ?? ""),
    paper_code: String(doc.paper_code ?? ""),
    paper_name: String(doc.paper_name ?? ""),
    subject: String(doc.subject ?? ""),
    unit_number: Number(doc.unit_number ?? 0),
    syllabus_content: String(doc.syllabus_content ?? ""),
    lectures:
      typeof doc.lectures === "number" && Number.isFinite(doc.lectures)
        ? doc.lectures
        : undefined,
    tags,
  };
}

export function buildPaperMarkdown(args: {
  paperCode: string;
  paperName: string;
  rows: SyllabusTableRow[];
  university?: string;
  course?: string;
  stream?: string;
  type?: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ${args.paperName}`);
  lines.push("");
  lines.push(`**Paper Code:** ${args.paperCode}`);
  if (args.university) lines.push(`**University:** ${args.university}`);
  if (args.course) lines.push(`**Course:** ${args.course}`);
  if (args.stream) lines.push(`**Stream:** ${args.stream}`);
  if (args.type) lines.push(`**Type:** ${args.type}`);
  lines.push("");
  const sorted = [...args.rows].sort((a, b) => a.unit_number - b.unit_number);
  for (const row of sorted) {
    lines.push(`## Unit ${row.unit_number}`);
    lines.push("");
    if (typeof row.lectures === "number") {
      lines.push(`**Lectures:** ${row.lectures}`);
      lines.push("");
    }
    lines.push(row.syllabus_content.trim() || "_No syllabus content._");
    lines.push("");
    if (row.tags.length > 0) {
      lines.push(`**Tags:** ${row.tags.join(", ")}`);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

export function derivePaperNameFromContent(content: string, fallback: string): string {
  const firstLine = content.split(PAPER_NAME_SPLIT_RE)[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : fallback;
}

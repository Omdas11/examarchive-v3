export interface SyllabusTableRow {
  id: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paper_code: string;
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
  subjectCode: string;
  units: number;
  lectures: number;
}

export function extractSubjectCode(paperCode: string): string {
  const upper = paperCode.trim().toUpperCase();
  if (!upper) return "GEN";
  const alphaPrefix = upper.match(/^[A-Z]+/)?.[0] ?? upper;
  if (alphaPrefix.length >= 3) return alphaPrefix.slice(0, 3);
  return upper.slice(0, 3) || "GEN";
}

export function toSyllabusTableRow(doc: Record<string, unknown>): SyllabusTableRow {
  const tags = Array.isArray(doc.tags)
    ? doc.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    id: String(doc.$id ?? doc.id ?? ""),
    university: String(doc.university ?? ""),
    course: String(doc.course ?? ""),
    stream: String(doc.stream ?? ""),
    type: String(doc.type ?? ""),
    paper_code: String(doc.paper_code ?? "").toUpperCase(),
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


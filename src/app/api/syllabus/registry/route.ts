import { NextResponse, type NextRequest } from "next/server";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { extractSubjectCode, toSyllabusTableRow } from "@/lib/syllabus-table";

type RegistryLikeEntry = {
  paper_code: string;
  paper_name: string;
  semester: number | null;
  subject: string;
  credits: number;
  programme: string;
  university: string;
  category: string;
};

function derivePaperNameFromContent(content: string, fallback: string): string {
  const firstLine = content.split(/[.;\n]/)[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : fallback;
}

async function listRegistryLikeEntries(): Promise<RegistryLikeEntry[]> {
  const db = adminDatabases();
  const rows: ReturnType<typeof toSyllabusTableRow>[] = [];
  let cursorAfter: string | null = null;
  const PAGE_LIMIT = 500;
  const MAX_PAGES = 20;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const queries = [
      Query.orderAsc("$id"),
      Query.limit(PAGE_LIMIT),
      cursorAfter ? Query.cursorAfter(cursorAfter) : null,
    ].filter(Boolean) as string[];
    const page = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, queries);
    rows.push(...page.documents.map((doc) => toSyllabusTableRow(doc as Record<string, unknown>)));
    if (page.documents.length < PAGE_LIMIT) break;
    cursorAfter = page.documents[page.documents.length - 1]?.$id ?? null;
    if (!cursorAfter) break;
    pages += 1;
  }

  const grouped = new Map<string, ReturnType<typeof toSyllabusTableRow>[]>();
  for (const row of rows) {
    const code = row.paper_code.trim().toUpperCase();
    if (!code) continue;
    if (!grouped.has(code)) grouped.set(code, []);
    grouped.get(code)!.push(row);
  }

  return Array.from(grouped.entries())
    .map(([paper_code, paperRows]) => {
      const first = paperRows[0];
      const unit1 = [...paperRows]
        .sort((a, b) => a.unit_number - b.unit_number)
        .find((r) => typeof r.syllabus_content === "string" && r.syllabus_content.trim().length > 0);
      return {
        paper_code,
        paper_name: derivePaperNameFromContent(unit1?.syllabus_content ?? "", paper_code),
        semester: null,
        subject: extractSubjectCode(paper_code),
        credits: 0,
        programme: first?.course ?? "",
        university: first?.university ?? "",
        category: first?.type ?? "",
      };
    })
    .sort((a, b) => a.paper_code.localeCompare(b.paper_code));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const distinct = searchParams.get("distinct");
  const q = searchParams.get("q");

  try {
    const entries = await listRegistryLikeEntries();
    if (distinct === "university") {
      const universities = Array.from(
        new Set(entries.map((entry) => entry.university).filter((u) => u.trim().length > 0)),
      ).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ universities });
    }

    if (code) {
      const normalizedCode = code.trim().toUpperCase();
      const entry = entries.find((item) => item.paper_code === normalizedCode);
      if (!entry) return NextResponse.json({ entry: null });
      return NextResponse.json({ entry });
    }
    const filtered =
      q && q.trim()
        ? entries.filter((e) =>
            [e.paper_code, e.paper_name, e.subject, e.university]
              .join(" ")
              .toLowerCase()
              .includes(q.trim().toLowerCase()),
          )
        : entries;

    return NextResponse.json({ entries: filtered });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

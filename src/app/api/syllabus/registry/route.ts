import { NextResponse, type NextRequest } from "next/server";
import { findRegistryEntry, listUniversities, loadSyllabusRegistry } from "@/lib/syllabus-registry";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const distinct = searchParams.get("distinct");
  const q = searchParams.get("q");

  try {
    if (distinct === "university") {
      const universities = await listUniversities();
      return NextResponse.json({ universities });
    }

    if (code) {
      const entry = await findRegistryEntry(code);
      if (!entry) return NextResponse.json({ entry: null });
      return NextResponse.json({ entry });
    }

    const entries = await loadSyllabusRegistry();
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


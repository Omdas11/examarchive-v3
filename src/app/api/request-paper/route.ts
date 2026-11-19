import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getD1 } from "@/lib/d1";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/request-paper — public paper-request form (browse empty state).
 * Guests included: the whole point is reaching students who cannot find a
 * paper. Stores the request in D1 `paper_requests`; the team fulfils it
 * manually and emails the requester a copy.
 * Body: { course_code?, paper_name?, semester?, year?, department?, email* }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      course_code?: unknown;
      paper_name?: unknown;
      semester?: unknown;
      year?: unknown;
      department?: unknown;
      email?: unknown;
    };

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    const courseCode = typeof body.course_code === "string" ? body.course_code.trim().slice(0, 64) : "";
    const paperName = typeof body.paper_name === "string" ? body.paper_name.trim().slice(0, 200) : "";
    if (!courseCode && !paperName) {
      return NextResponse.json(
        { ok: false, error: "Please enter the course code or the paper name." },
        { status: 400 },
      );
    }
    const semester = typeof body.semester === "string" ? body.semester.trim().slice(0, 16) : null;
    const year =
      typeof body.year === "number" && Number.isInteger(body.year) && body.year >= 2000 && body.year <= 2100
        ? body.year
        : null;
    const department = typeof body.department === "string" ? body.department.trim().slice(0, 64) : null;

    const db = await getD1();
    const now = Date.now();
    await db
      .prepare(
        "INSERT INTO paper_requests (id, course_code, paper_name, semester, year, department, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?)",
      )
      .bind(
        randomUUID(),
        courseCode || null,
        paperName || null,
        semester,
        year,
        department,
        email,
        now,
        now,
      )
      .run();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not send the request. Please try again." },
      { status: 500 },
    );
  }
}

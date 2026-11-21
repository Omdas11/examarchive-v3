import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1, getPapersBucket } from "@/lib/d1";
import { canAccessMdVerification } from "@/lib/md-verification-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/md-verification/[id]/pdf — stream the uploaded PDF from R2.
 * The bucket is not public: only a verifier (moderator, founder, or
 * assigned verifier) can fetch it, and only through this route.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT pdf_key, paper_code FROM md_verification_items WHERE id = ? LIMIT 1",
      )
      .bind(id)
      .first<{ pdf_key: string | null; paper_code: string }>();
    if (!row || !row.pdf_key) {
      return NextResponse.json(
        { error: "No PDF uploaded for this item" },
        { status: 404 },
      );
    }
    const bucket = await getPapersBucket();
    const object = await bucket.get(row.pdf_key);
    if (!object) {
      return NextResponse.json(
        { error: "PDF not found in storage" },
        { status: 404 },
      );
    }
    return new NextResponse(object.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${row.paper_code}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load the PDF" },
      { status: 500 },
    );
  }
}

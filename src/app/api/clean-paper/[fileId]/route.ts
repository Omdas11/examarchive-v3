import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  adminStorage,
  CLEAN_PAPERS_BUCKET_ID,
  COLLECTION,
  DATABASE_ID,
} from "@/lib/appwrite";
import { withCreditBalanceLock } from "@/lib/credit-lock";
import { CLEAN_PAPER_COST_CREDITS } from "@/lib/economy";

export const fetchCache = "force-no-store";

/**
 * GET /api/clean-paper/[fileId]
 * Serves the cleaned print-perfect question-paper PDF for 2 tokens.
 * Stamps a per-user footer ("Personalized copy for {email}") on every page
 * to disincentivize redistribution.
 * 402 when the balance is insufficient, 404 when not yet digitized.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const { fileId } = await params;
  if (!fileId || /[^a-zA-Z0-9]/.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id." }, { status: 400 });
  }

  const storage = adminStorage();
  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await storage.getFileDownload(CLEAN_PAPERS_BUCKET_ID, fileId);
  } catch {
    return NextResponse.json(
      { error: "Clean version not yet available for this paper." },
      { status: 404 },
    );
  }

  // Deduct tokens under a balance lock.
  try {
    await withCreditBalanceLock(user.id, async () => {
      const db = adminDatabases();
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      const current = Number(profile.ai_credits ?? 0);
      if (!Number.isFinite(current) || current < CLEAN_PAPER_COST_CREDITS) {
        throw new Error("INSUFFICIENT_CREDITS");
      }
      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        ai_credits: current - CLEAN_PAPER_COST_CREDITS,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        { error: "Not enough tokens.", cost: CLEAN_PAPER_COST_CREDITS },
        { status: 402 },
      );
    }
    throw error;
  }

  // Stamp per-user footer on every page.
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const label = `Personalized copy for ${user.email ?? "examarchive user"}`;
  for (const page of pdfDoc.getPages()) {
    const { width } = page.getSize();
    page.drawText(label, {
      x: width / 2 - font.widthOfTextAtSize(label, 8) / 2,
      y: 18,
      size: 8,
      font,
      color: rgb(0.5, 0, 0),
      opacity: 0.75,
    });
  }
  const stamped = await pdfDoc.save();

  // Cast to a plain Uint8Array for NextResponse (Buffer is a Uint8Array subclass).
  const body = new Uint8Array(stamped);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="clean-paper-${fileId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

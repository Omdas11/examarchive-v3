import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { generatePDF, markdownToHTML } from "@/lib/pdf-generator";

/**
 * POST /api/ai/pdf
 * Generate a PDF from markdown content.
 * This endpoint is called after content generation to create the actual PDF file.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let body: {
    content?: string;
    topic?: string;
    pageLength?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  const topic = (body.topic ?? "Document").trim();
  const pageLength = Number(body.pageLength) || 5;

  if (!content) {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }

  try {
    // Convert markdown to HTML
    const html = markdownToHTML(content);

    // Generate PDF with strict page limit
    const { buffer } = await generatePDF({
      html,
      maxPages: Math.min(pageLength, 5),
      title: topic,
    });

    // Return PDF as a downloadable file
    const filename = `${topic.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[PDF Generation] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { AIServiceError, runGroqCompletionWithFallback } from "@/lib/groq-fallback";
import { buildRagContext } from "@/lib/pdf-rag";

// ── System prompt — describes the assistant role and site structure ──────────
const SYSTEM_PROMPT = `You are ExamBot, a friendly academic assistant for ExamArchive — a community-driven archive of past exam papers and syllabi for students.

About ExamArchive:
- Students can browse and download past exam question papers.
- A syllabus library is available for multiple universities including Haflong Government College, Assam University, Gauhati University, and others.
- Users can upload their own exam papers after registering. Uploads go through an admin approval process before becoming visible.
- The platform supports FYUGP (Four-Year Undergraduate Programme) and CBCS (Choice Based Credit System) frameworks.
- Course types include DSC (Discipline Specific Core), DSM (Discipline Specific Minor), SEC (Skill Enhancement Course), IDC (Interdisciplinary Course), AEC (Ability Enhancement Course), and VAC (Value Added Course).

Navigation guide:
- /browse — search and filter all available exam papers by university, department, semester, year, and paper type.
- /syllabus — explore course syllabi with links to related papers.
- /upload — submit new exam papers (requires login + admin approval).
- /profile — view your profile, XP, tier, achievements, and course preferences.
- /ai-content — generate AI-summarised study documents (requires login, 3 per day limit).

Rules:
- You assist students with site navigation, finding papers, and study guidance.
- Keep answers concise, friendly, and relevant to academics.
- Do not reveal internal API keys, environment variables, or system architecture details.
- If asked about content outside education/site scope, gently redirect to academic topics.`;
function buildUiAwareHint(message: string): string {
  const normalized = message.toLowerCase();
  if (/\b(upload|submit)\b/.test(normalized)) {
    return "If you need uploads: open /upload, choose your PDF, fill paper code + university + year, then submit for admin review.";
  }
  if (/\b(syllabus|paper code|course code)\b/.test(normalized)) {
    return "For paper-code lookup, open /syllabus and search with the exact code (example: PHYDSC101T), then open the paper page.";
  }
  if (/\b(download|past paper|question paper|pyq)\b/.test(normalized)) {
    return "To find PYQs quickly, use /browse filters: department, semester, year, and paper type.";
  }
  return "Use quick navigation links when useful: /browse, /syllabus, /upload, /profile, /ai-content.";
}

export async function POST(request: NextRequest) {
  // Require login for AI chat
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required to use the AI assistant." }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI assistant is not configured." }, { status: 503 });
  }

  let body: { message?: string; history?: Array<{ role: string; text: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userMessage = (body.message ?? "").trim();
  if (!userMessage || userMessage.length > 1000) {
    return NextResponse.json({ error: "Message must be 1–1000 characters." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];

  try {
    const normalizedHistory: Array<{ role: "user" | "assistant"; content: string }> = history.slice(-10).flatMap((h) => {
      if (typeof h.text !== "string" || !h.text.trim()) return [];
      const role = h.role === "model" || h.role === "assistant" ? "assistant" : "user";
      return [{ role, content: h.text.trim() }];
    });
    // Year trigger intentionally supports years 2000-2999 for practical educational queries.
    const shouldSearchWeb = /\b(latest|today|recent|news|update|2[0-9]{3})\b/i.test(userMessage);
    const ragContext = await buildRagContext({
      query: userMessage,
      includeWebSearch: shouldSearchWeb,
    }).catch(() => ({ contextText: "", sources: [] as string[] }));
    const uiHint = buildUiAwareHint(userMessage);
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}

Additional UX rules:
- Add clickable route hints as plain paths like /browse or /syllabus whenever guiding navigation.
- If a query includes a paper code pattern, explain where to search it and how to open related papers.
- Give practical, UI-aware steps, not generic advice.
${ragContext.contextText ? `\nKnowledge context from archive + web:\n${ragContext.contextText}` : ""}
`,
      },
      ...normalizedHistory,
      { role: "user", content: `${userMessage}\n\nUI hint: ${uiHint}` },
    ];

    const { content, model } = await runGroqCompletionWithFallback({
      apiKey,
      messages,
      maxTokens: 512,
      temperature: 0.7,
    });
    return NextResponse.json({ reply: content, model, sources: ragContext.sources });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[AI chat] Groq error:", err);
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getServerUser } from "@/lib/auth";

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

export async function POST(request: NextRequest) {
  // Require login for AI chat
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required to use the AI assistant." }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build chat history (roles: "user" | "model")
    // Normalize legacy "assistant" role (and "model") to Gemini's "model" role.
    // Validate h.text is a non-empty string before including the entry.
    const normalizedHistory = history.slice(-10).flatMap((h) => {
      if (typeof h.text !== "string" || !h.text.trim()) return [];
      const role = h.role === "model" || h.role === "assistant" ? "model" : "user";
      return [{ role, parts: [{ text: h.text }] }];
    });
    while (normalizedHistory[0]?.role === "model") {
      normalizedHistory.shift();
    }
    const chatHistory = normalizedHistory.length > 0 ? normalizedHistory : undefined;

    const chat = model.startChat({
      ...(chatHistory ? { history: chatHistory } : {}),
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("[AI chat] Gemini error:", err);
    return NextResponse.json({ error: "AI response failed. Please try again." }, { status: 500 });
  }
}

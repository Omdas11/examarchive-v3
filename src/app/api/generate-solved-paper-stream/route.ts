import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readSolvedPaperPrompt } from "@/lib/solved-paper-prompt";
import { formatSearchResults, runWebSearch } from "@/lib/web-search";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";

const QUESTION_LOOP_DELAY_MS = 4500;

function toSseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTavilyContext(query: string): Promise<string> {
  const results = await runWebSearch(query, 5);
  return formatSearchResults(results) || "No Tavily context found.";
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const isAdminPlus = user.role === "admin" || user.role === "founder";
  const quota = await checkAndResetQuotas(user.id);
  if (!isAdminPlus && quota.papers_solved_today >= 1) {
    return NextResponse.json(
      { error: "Daily limit reached for Solved Papers (1/day)." },
      { status: 429 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const university = (searchParams.get("university") || "Assam University").trim();
  const course = (searchParams.get("course") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const paperCode = (searchParams.get("paperCode") || "").trim();
  const year = normalizeNumber(searchParams.get("year"));

  if (!course || !type || !paperCode || year === null) {
    return NextResponse.json(
      { error: "Invalid selection. Please choose course, type, paper code, and year." },
      { status: 400 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let isClosed = false;
      const closeStream = () => {
        if (isClosed) return;
        isClosed = true;
        controller.close();
      };

      try {
        const db = adminDatabases();
        const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
          Query.equal("university", university),
          Query.equal("course", course),
          Query.equal("type", type),
          Query.equal("paper_code", paperCode),
          Query.equal("year", year),
          Query.orderAsc("question_no"),
          Query.limit(500),
        ]);

        const questions = questionsRes.documents.filter((doc) =>
          typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
        );

        if (questions.length === 0) {
          controller.enqueue(toSseData({ event: "error", error: "No questions found for the selected paper/year." }));
          closeStream();
          return;
        }

        const solvedPaperPromptTemplate = readSolvedPaperPrompt();
        const model = "gemini-3.1-flash-lite-preview";
        let masterMarkdown = "";

        for (const [index, questionDoc] of questions.entries()) {
          const qNo = String(questionDoc.question_no ?? index + 1).trim();
          const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
          const qLabel = `Q${qNo}${qSub ? `(${qSub})` : ""}`;
          const questionContent = String(questionDoc.question_content ?? "").trim();
          const marks =
            typeof questionDoc.marks === "number"
              ? questionDoc.marks
              : normalizeNumber(questionDoc.marks);

          controller.enqueue(toSseData({
            event: "progress",
            status: `Searching web and solving ${qLabel} (${index + 1}/${questions.length})...`,
            index: index + 1,
            total: questions.length,
            question: qLabel,
          }));

          const tavilyContext = await fetchTavilyContext(questionContent);

          const prompt = `${solvedPaperPromptTemplate}

University: ${university}
Course: ${course}
Type: ${type}
Paper Code: ${paperCode}
Year: ${year}
Question Label: ${qLabel}
Marks: ${marks ?? "N/A"}

Question:
${questionContent}

Tavily Web Context:
${tavilyContext}
`;

          const result = await runGeminiCompletion({
            apiKey: geminiApiKey,
            prompt,
            maxTokens: 8192,
            temperature: 0.3,
            model,
          });

          const solvedChunk = String(result.content ?? "").trim() || "_No solution generated._";
          if (masterMarkdown) masterMarkdown += "\n\n";
          masterMarkdown += `### ${qLabel}: ${questionContent}\n\n${solvedChunk}\n\n---\n`;

          await sleep(QUESTION_LOOP_DELAY_MS);
        }

        controller.enqueue(toSseData({
          event: "done",
          markdown: masterMarkdown.trim(),
          model,
          total: questions.length,
        }));
        if (!isAdminPlus) {
          await incrementQuotaCounter(user.id, "papers_solved_today");
        }
      } catch (error) {
        if (error instanceof GeminiServiceError) {
          controller.enqueue(toSseData({ event: "error", error: error.message, status: error.status }));
        } else {
          console.error("[generate-solved-paper-stream] Failed:", error);
          controller.enqueue(toSseData({ event: "error", error: "Failed to generate solved paper." }));
        }
      } finally {
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

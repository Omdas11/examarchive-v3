import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readSolvedPaperPrompt } from "@/lib/solved-paper-prompt";
import { formatSearchResults, runWebSearch } from "@/lib/web-search";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";

export const maxDuration = 300;

const QUESTION_LOOP_DELAY_MS = 7000;
const PART_SIZE = 10;
const QUESTION_MAX_RETRIES = 4;
const RETRY_ERROR_DELAY_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 15000;
const MIN_SOLUTION_RESPONSE_CHARS = 10;
// Solved-paper streaming runs close to serverless time limits, so web search must fail fast.
const TAVILY_TIMEOUT_MS = 4000;
const GENERATING_STATUS = "generating";
const COMPLETED_STATUS = "completed";
const INITIAL_LAST_PROCESSED_INDEX = -1;

type SolvedPaperCheckpoint = {
  id: string;
  markdown: string;
  status: string;
  lastProcessedIndex: number;
};

function toSseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function toSseComment(comment: string): Uint8Array {
  return new TextEncoder().encode(`: ${comment}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return status === 429 || message.includes("429");
}

async function fetchTavilyContext(query: string): Promise<string> {
  try {
    const results = await runWebSearch(query, 5, TAVILY_TIMEOUT_MS);
    return formatSearchResults(results) || "";
  } catch (error) {
    console.warn("Tavily search timed out, proceeding without context", error);
    return "";
  }
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Extract a sortable question number from mixed input types.
 * @param value Question number as number/string/unknown from DB row.
 * Returns Number.MAX_SAFE_INTEGER when no numeric value can be parsed,
 * so malformed question numbers are pushed to the end of sorted results.
 */
function extractQuestionNumber(value: unknown): number {
  const normalized = normalizeNumber(value);
  if (normalized !== null) return normalized;
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

async function getDailyCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

async function recordGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.ai_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to record usage:", error);
  }
}

function getSolvedPaperCacheKey(course: string, type: string, paperCode: string): string {
  return `${course}::${type}::${paperCode}`.slice(0, 128);
}

async function readSolvedPaperCheckpoint(
  cachePaperCode: string,
  year: number,
): Promise<SolvedPaperCheckpoint | null> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
      Query.equal("paper_code", cachePaperCode),
      Query.equal("unit_number", year),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    return {
      id: String(doc.$id),
      markdown: typeof doc.generated_markdown === "string" ? doc.generated_markdown : "",
      status: typeof doc.status === "string" ? doc.status : "",
      lastProcessedIndex:
        typeof doc.last_processed_index === "number"
          ? doc.last_processed_index
          : INITIAL_LAST_PROCESSED_INDEX,
    };
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to read checkpoint:", error);
    return null;
  }
}

async function upsertSolvedPaperCheckpoint(params: {
  checkpointId: string | null;
  cachePaperCode: string;
  year: number;
  markdown: string;
  status: string;
  lastProcessedIndex: number;
}): Promise<string | null> {
  const db = adminDatabases();
  const buildPayload = (docId: string) => ({
    id: docId,
    paper_code: params.cachePaperCode,
    unit_number: params.year,
    generated_markdown: params.markdown,
    syllabus_content: "",
    created_at: new Date().toISOString(),
    status: params.status,
    last_processed_index: params.lastProcessedIndex,
  });
  try {
    const tryUpdateById = async (docId: string): Promise<boolean> => {
      try {
        await db.updateDocument(
          DATABASE_ID,
          COLLECTION.generated_notes_cache,
          docId,
          buildPayload(docId),
        );
        return true;
      } catch (error) {
        console.warn(
          `[generate-solved-paper-stream] Checkpoint update failed for id=${docId}; falling back to query-based update/create:`,
          error,
        );
        return false;
      }
    };

    if (params.checkpointId && (await tryUpdateById(params.checkpointId))) {
      return params.checkpointId;
    }

    let queriedCheckpointId: string | undefined;
    try {
      const existing = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
        Query.equal("paper_code", params.cachePaperCode),
        Query.equal("unit_number", params.year),
        Query.orderDesc("$createdAt"),
        Query.limit(1),
      ]);
      queriedCheckpointId = existing.documents[0]?.$id;
    } catch (error) {
      console.warn(
        "[generate-solved-paper-stream] Checkpoint lookup failed; falling back to create:",
        error,
      );
    }
    if (queriedCheckpointId && (await tryUpdateById(queriedCheckpointId))) {
      return queriedCheckpointId;
    }

    const createdId = ID.unique();
    const created = await db.createDocument(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      createdId,
      buildPayload(createdId),
    );
    return String(created.$id);
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to persist checkpoint:", error);
    return params.checkpointId;
  }
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const metaFlag = (searchParams.get("meta") || "").toLowerCase();
  const metaOnly = metaFlag === "1" || metaFlag === "true";
  const partParam = searchParams.get("part");
  const parsedPart = partParam === null ? 1 : Number(partParam);
  if (!Number.isInteger(parsedPart) || parsedPart < 1) {
    return NextResponse.json({ error: "Invalid part parameter. Must be a positive integer." }, { status: 400 });
  }
  const part = parsedPart;

  const isAdminPlus = user.role === "admin" || user.role === "founder";
  const quota = await checkAndResetQuotas(user.id);
  if (!metaOnly && !isAdminPlus && quota.papers_solved_today >= 1) {
    return NextResponse.json(
      { error: "Daily limit reached for Solved Papers (1/day)." },
      { status: 429 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
  }

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
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year. Please provide a valid year between 1900 and 2100." },
      { status: 400 },
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = getDailyLimit();
  let usedBefore = 0;
  if (!metaOnly && !isAdminPlus) {
    usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
  }

  if (metaOnly) {
    try {
      const db = adminDatabases();
      const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
        Query.equal("university", university),
        Query.equal("course", course),
        Query.equal("type", type),
        Query.equal("paper_code", paperCode),
        Query.equal("year", year),
        Query.limit(500),
      ]);
      const totalQuestions = questionsRes.documents.filter((doc) =>
        typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
      ).length;
      const totalParts = Math.max(1, Math.ceil(totalQuestions / PART_SIZE));
      return NextResponse.json({
        totalQuestions,
        partSize: PART_SIZE,
        totalParts,
        etaMinutes: totalParts * 5,
      });
    } catch (error) {
      console.error("[generate-solved-paper-stream] Failed to read question metadata:", error);
      return NextResponse.json({ error: "Failed to fetch solved-paper metadata." }, { status: 500 });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let isClosed = false;
      const heartbeat = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(toSseComment("heartbeat"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);
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

        const allQuestions = questionsRes.documents
          .filter((doc) => typeof doc.question_content === "string" && doc.question_content.trim().length > 0)
          .sort((a, b) => {
            const questionNumberCompare = extractQuestionNumber(a.question_no) - extractQuestionNumber(b.question_no);
            if (questionNumberCompare !== 0) return questionNumberCompare;
            const aSub = typeof a.question_subpart === "string" ? a.question_subpart : "";
            const bSub = typeof b.question_subpart === "string" ? b.question_subpart : "";
            // subparts may contain mixed forms like "2", "2a", "10b", so keep locale numeric compare.
            return aSub.localeCompare(bSub, undefined, { sensitivity: "base", numeric: true });
          });

        if (allQuestions.length === 0) {
          controller.enqueue(toSseData({ event: "error", error: "No questions found for the selected paper/year." }));
          closeStream();
          return;
        }
        const totalParts = Math.max(1, Math.ceil(allQuestions.length / PART_SIZE));
        if (part > totalParts) {
          controller.enqueue(toSseData({ event: "error", error: `Invalid part ${part}. Last available part is ${totalParts}.` }));
          closeStream();
          return;
        }
        const requestedStartIndex = (part - 1) * PART_SIZE;
        const requestedEndIndex = Math.min(requestedStartIndex + PART_SIZE, allQuestions.length);

        const solvedPaperPromptTemplate = readSolvedPaperPrompt();
        const model = "gemini-3.1-flash-lite-preview";
        const cachePaperCode = getSolvedPaperCacheKey(course, type, paperCode);
        const checkpoint = await readSolvedPaperCheckpoint(cachePaperCode, year);
        if (checkpoint?.status === COMPLETED_STATUS && checkpoint.markdown.trim().length > 0) {
          controller.enqueue(toSseData({
            event: "done",
            markdown: checkpoint.markdown.trim(),
            model: "cache",
            total: allQuestions.length,
            cached: true,
          }));
          closeStream();
          return;
        }

        // Keep already-generated content when continuing chained parts, and also
        // when part 1 is retrying/resuming an interrupted "generating" checkpoint.
        const shouldAccumulateCheckpointMarkdown =
          part > 1 || checkpoint?.status === GENERATING_STATUS;
        let masterMarkdown = shouldAccumulateCheckpointMarkdown ? checkpoint?.markdown ?? "" : "";
        if (masterMarkdown && !masterMarkdown.endsWith("\n")) {
          masterMarkdown += "\n";
        }
        let lastProcessedIndex =
          typeof checkpoint?.lastProcessedIndex === "number"
            ? checkpoint.lastProcessedIndex
            : INITIAL_LAST_PROCESSED_INDEX;
        const resumeStartIndex = lastProcessedIndex + 1;
        // When resuming an interrupted generation, never go backwards.
        const startIndex = checkpoint?.status === GENERATING_STATUS
          ? Math.max(0, resumeStartIndex, requestedStartIndex)
          : requestedStartIndex;
        const endIndex = Math.min(Math.max(startIndex, requestedEndIndex), allQuestions.length);
        const isLastPart = endIndex >= allQuestions.length;
        let checkpointId =
          (await upsertSolvedPaperCheckpoint({
            checkpointId: checkpoint?.id ?? null,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: GENERATING_STATUS,
            lastProcessedIndex,
          })) ?? checkpoint?.id ?? null;

        if (checkpoint?.status === GENERATING_STATUS) {
          controller.enqueue(toSseData({
            event: "progress",
            status: `Resuming generation from question ${startIndex + 1}...`,
            index: startIndex,
            total: allQuestions.length,
          }));
        }
        if (startIndex >= allQuestions.length) {
          checkpointId = await upsertSolvedPaperCheckpoint({
            checkpointId,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: COMPLETED_STATUS,
            lastProcessedIndex: allQuestions.length - 1,
          });
          controller.enqueue(toSseData({
            event: "done",
            markdown: masterMarkdown.trim(),
            model: "cache",
            total: allQuestions.length,
            cached: true,
          }));
          closeStream();
          return;
        }

        for (const [offset, questionDoc] of allQuestions.slice(startIndex, endIndex).entries()) {
          const index = startIndex + offset;
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
            status: `Searching web and solving ${qLabel} (${index + 1}/${allQuestions.length})...`,
            index: index + 1,
            total: allQuestions.length,
            question: qLabel,
            part,
            totalParts,
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

          let aiResponseText = "";
          let retries = 0;
          while (retries < QUESTION_MAX_RETRIES) {
            try {
              const result = await runGeminiCompletion({
                apiKey: geminiApiKey,
                prompt,
                maxTokens: 8192,
                temperature: 0.3,
                model,
              });
              const candidate = String(result.content ?? "").trim();
              if (candidate.length > MIN_SOLUTION_RESPONSE_CHARS) {
                aiResponseText = candidate;
                break;
              }
            } catch (error) {
              if (isRateLimitError(error)) {
                controller.enqueue(toSseData({
                  event: "progress",
                  status: "Rate limit hit. Retrying immediately without extra delay...",
                  index: index + 1,
                  total: allQuestions.length,
                  question: qLabel,
                  part,
                  totalParts,
                }));
              } else {
                console.error("[generate-solved-paper-stream] Gemini API error:", error);
                await sleep(RETRY_ERROR_DELAY_MS);
              }
            }
            retries += 1;
          }

          const solvedChunk = aiResponseText || "_No solution generated after retries._";
          if (masterMarkdown) masterMarkdown += "\n\n";
          masterMarkdown += `### ${qLabel}: ${questionContent}\n\n${solvedChunk}\n\n---\n`;
          lastProcessedIndex = index;
          checkpointId = await upsertSolvedPaperCheckpoint({
            checkpointId,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: GENERATING_STATUS,
            lastProcessedIndex,
          });

          await sleep(QUESTION_LOOP_DELAY_MS);
        }

        await upsertSolvedPaperCheckpoint({
          checkpointId,
          cachePaperCode,
          year,
          markdown: masterMarkdown,
          status: isLastPart ? COMPLETED_STATUS : GENERATING_STATUS,
          lastProcessedIndex,
        });

        if (!isLastPart) {
          controller.enqueue(toSseData({
            event: "handoff",
            action: "auto_continue",
            nextPart: part + 1,
            part,
            totalParts,
            total: allQuestions.length,
          }));
          closeStream();
          return;
        }

        controller.enqueue(toSseData({
          event: "done",
          markdown: masterMarkdown.trim(),
          model,
          total: allQuestions.length,
          part,
          totalParts,
        }));
        if (!isAdminPlus) {
          await recordGeneration(user.id, todayStr);
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
        clearInterval(heartbeat);
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

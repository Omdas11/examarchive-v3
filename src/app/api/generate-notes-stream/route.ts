import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readTopicNotesPrompt } from "@/lib/topic-notes-prompt";

const TOPIC_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1200;
const CHUNK_MIN_CHARS = 150;
const CHUNK_MAX_CHARS = 250;
const CHUNK_MAX_SENTENCES = 3;

function isAdminPlus(role: string): boolean {
  return role === "admin" || role === "founder";
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function splitSyllabusIntoSubTopics(syllabusContent: string): string[] {
  const sentences = syllabusContent
    .split(".")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const grouped: string[] = [];
  let buffer = "";
  let sentenceCount = 0;

  for (const sentence of sentences) {
    const next = buffer ? `${buffer}. ${sentence}` : sentence;
    const nextSentenceCount = sentenceCount + 1;
    const shouldFlushBySize = next.length >= CHUNK_MAX_CHARS;
    const shouldFlushByLengthAndCount = next.length >= CHUNK_MIN_CHARS && nextSentenceCount >= 2;
    const shouldFlushByCount = nextSentenceCount >= CHUNK_MAX_SENTENCES;

    buffer = next;
    sentenceCount = nextSentenceCount;

    if (shouldFlushBySize || shouldFlushByLengthAndCount || shouldFlushByCount) {
      grouped.push(buffer);
      buffer = "";
      sentenceCount = 0;
    }
  }

  if (buffer) grouped.push(buffer);
  return grouped;
}

function normalizeTopicHeading(topic: string): string {
  return topic
    .replace(/^#+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGeneratedTopicMarkdown(topic: string, markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return trimmed;
  const firstLine = trimmed.split("\n")[0]?.trim() || "";
  const normalizedTopic = normalizeTopicHeading(topic).toLowerCase();
  const normalizedFirstLine = normalizeTopicHeading(firstLine).toLowerCase();
  if (normalizedFirstLine === normalizedTopic) {
    return trimmed.split("\n").slice(1).join("\n").trim();
  }
  return trimmed;
}

async function readCachedNotes(paperCode: string, unitNumber: number): Promise<string | null> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
      Query.equal("paper_code", paperCode),
      Query.equal("unit_number", unitNumber),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    const markdown = String(doc.generated_markdown ?? "").trim();
    return markdown || null;
  } catch (error) {
    console.error("[generate-notes-stream] Failed to read cache:", error);
    return null;
  }
}

async function writeCachedNotes(paperCode: string, unitNumber: number, markdown: string): Promise<void> {
  const db = adminDatabases();
  try {
    // Keep explicit created_at because schema/docs require this field for cache reads and audits.
    const payload = {
      paper_code: paperCode,
      unit_number: unitNumber,
      generated_markdown: markdown,
      created_at: new Date().toISOString(),
    };
    await db.createDocument(DATABASE_ID, COLLECTION.generated_notes_cache, ID.unique(), payload);
  } catch (error) {
    console.error("[generate-notes-stream] Failed to write cache:", error);
  }
}

function formatQuestionsForPrompt(questions: Array<Record<string, unknown>>, unitNumber: number): string {
  return questions
    .filter((questionDoc) => {
      const unitRaw = questionDoc.unit_number;
      if (typeof unitRaw === "number") return unitRaw === unitNumber;
      if (typeof unitRaw === "string") {
        const parsed = Number(unitRaw);
        return Number.isInteger(parsed) ? parsed === unitNumber : true;
      }
      return true;
    })
    .map((questionDoc, idx) => {
      const content = typeof questionDoc.question_content === "string" ? questionDoc.question_content.trim() : "";
      if (!content) return null;
      const marks = typeof questionDoc.marks === "number" ? `${questionDoc.marks} marks` : "marks N/A";
      const number = questionDoc.question_no ?? idx + 1;
      const sub = questionDoc.question_subpart ? `(${questionDoc.question_subpart})` : "";
      return `${idx + 1}. Q${number}${sub}: ${content} [${marks}]`;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function toSseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    console.error("[generate-notes-stream] Failed to record usage:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
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
  const unitNumber = Number(searchParams.get("unitNumber"));

  if (!course || !type || !paperCode || !Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
    return NextResponse.json({ error: "Invalid selection. Please choose course, type, paper code, and unit 1-5." }, { status: 400 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = getDailyLimit();
  let usedBefore = 0;

  if (!isAdminPlus(user.role)) {
    usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
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
        const cachedMarkdown = await readCachedNotes(paperCode, unitNumber);
        if (cachedMarkdown) {
          const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - (usedBefore + 1));
          if (!isAdminPlus(user.role)) {
            await recordGeneration(user.id, todayStr);
          }
          controller.enqueue(toSseData({
            event: "done",
            markdown: cachedMarkdown,
            model: "cache",
            remaining,
            cached: true,
          }));
          closeStream();
          return;
        }

        const db = adminDatabases();
        const syllabusRes = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
          Query.equal("university", university),
          Query.equal("course", course),
          Query.equal("type", type),
          Query.equal("paper_code", paperCode),
          Query.equal("unit_number", unitNumber),
          Query.limit(1),
        ]);

        const syllabusDoc = syllabusRes.documents[0];
        if (!syllabusDoc) {
          controller.enqueue(toSseData({ event: "error", error: "No syllabus data found for this unit." }));
          closeStream();
          return;
        }

        const syllabusContent = typeof syllabusDoc.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
        if (!syllabusContent) {
          controller.enqueue(toSseData({ event: "error", error: "Syllabus content is empty for this unit." }));
          closeStream();
          return;
        }

        const syllabusTags = normalizeTags(syllabusDoc.tags);
        const subTopics = splitSyllabusIntoSubTopics(syllabusContent);
        if (subTopics.length === 0) {
          controller.enqueue(toSseData({ event: "error", error: "No sub-topics found for this unit." }));
          closeStream();
          return;
        }

        const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
          Query.equal("paper_code", paperCode),
          Query.limit(500),
        ]);
        const formattedQuestions = formatQuestionsForPrompt(questionsRes.documents, unitNumber);
        const topicPromptTemplate = readTopicNotesPrompt();
        let masterMarkdown = "";
        const model = "gemini-3.1-flash-lite-preview";

        for (const [index, topic] of subTopics.entries()) {
          controller.enqueue(toSseData({
            event: "progress",
            status: `Generating topic ${index + 1} of ${subTopics.length}...`,
            topic,
            index: index + 1,
            total: subTopics.length,
          }));

          const prompt = `${topicPromptTemplate}

University: ${university}
Course: ${course}
Type: ${type}
Paper Code: ${paperCode}
Unit Number: ${unitNumber}
Unit Tags: ${syllabusTags.length > 0 ? syllabusTags.join(", ") : "N/A"}

Current Sub-Topic:
${topic}

All Questions for this Unit:
${formattedQuestions || "No related questions found."}
`;

          let result: Awaited<ReturnType<typeof runGeminiCompletion>> | null = null;
          let lastTopicError: GeminiServiceError | null = null;

          for (let attempt = 1; attempt <= TOPIC_MAX_ATTEMPTS; attempt++) {
            try {
              if (attempt > 1) {
                controller.enqueue(toSseData({
                  event: "progress",
                  status: `Retrying topic ${index + 1} of ${subTopics.length} (attempt ${attempt}/${TOPIC_MAX_ATTEMPTS})...`,
                  topic,
                  index: index + 1,
                  total: subTopics.length,
                }));
              }

              result = await runGeminiCompletion({
                apiKey: geminiApiKey,
                prompt,
                maxTokens: 8192,
                temperature: 0.4,
                model,
              });
              lastTopicError = null;
              break;
            } catch (error) {
              if (!(error instanceof GeminiServiceError)) throw error;
              lastTopicError = error;
              if (attempt < TOPIC_MAX_ATTEMPTS) {
                await sleep(attempt * RETRY_BACKOFF_MS);
              }
            }
          }

          if (!result) {
            const message = lastTopicError?.message || "Unknown generation error";
            const isEmptyResponse = /empty response/i.test(message);
            if (isEmptyResponse) {
              controller.enqueue(toSseData({
                event: "progress",
                status: `Topic ${index + 1} returned an empty response after retries. Continuing with remaining topics...`,
                topic,
                index: index + 1,
                total: subTopics.length,
              }));
              const fallbackMarkdown = [
                `## ${topic}`,
                "",
                "> ⚠️ This topic could not be generated because the model returned an empty response after multiple retries.",
                "> Remaining topics were generated normally.",
              ].join("\n");
              if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
              masterMarkdown += fallbackMarkdown;
              continue;
            }
            throw lastTopicError;
          }

          const cleanedTopicMarkdown = cleanGeneratedTopicMarkdown(topic, result.content);
          if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
          masterMarkdown += `## ${topic}\n\n${cleanedTopicMarkdown}`;
        }

        await writeCachedNotes(paperCode, unitNumber, masterMarkdown);

        if (!isAdminPlus(user.role)) {
          await recordGeneration(user.id, todayStr);
        }
        const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - (usedBefore + 1));
        controller.enqueue(toSseData({ event: "done", markdown: masterMarkdown, model, remaining }));
      } catch (error) {
        if (error instanceof GeminiServiceError) {
          const message =
            error.status === 429 ? "AI rate limit reached. Please wait a moment and try again." : error.message;
          controller.enqueue(toSseData({ event: "error", error: message, status: error.status }));
        } else {
          console.error("[generate-notes-stream] Failed:", error);
          controller.enqueue(toSseData({ event: "error", error: "Failed to generate notes." }));
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

import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readTopicNotesPrompt } from "@/lib/topic-notes-prompt";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";

const TOPIC_MAX_ATTEMPTS = 3;
const EMPTY_RESPONSE_RETRY_MS = 2000;
const TOPIC_LOOP_DELAY_MS = 4500;
const MIN_TOPIC_RESPONSE_CHARS = 50;

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
  return syllabusContent
    .split(/(?<=[.;])\s+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
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

function stripPromptLeakToFirstHeading(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "";
  const firstHeadingIndex = trimmed.search(/^#{1,2}\s+.+/m);
  if (firstHeadingIndex < 0) return trimmed;
  return trimmed.slice(firstHeadingIndex).trim();
}

function ensureTopicMarkdownHeader(topic: string, markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return `## ${topic}`;
  const firstLine = trimmed.split("\n")[0]?.trim() || "";
  if (/^##\s+\S/.test(firstLine)) return trimmed;
  return `## ${topic}\n\n${trimmed}`;
}

type CachedNotes = {
  markdown: string;
  syllabusContent: string | null;
};

async function readCachedNotes(paperCode: string, unitNumber: number): Promise<CachedNotes | null> {
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
    if (!markdown) return null;
    const syllabusContent = typeof doc.syllabus_content === "string" ? doc.syllabus_content.trim() : "";
    return { markdown, syllabusContent: syllabusContent || null };
  } catch (error) {
    console.error("[generate-notes-stream] Failed to read cache:", error);
    return null;
  }
}

async function readSyllabusContent(
  university: string,
  course: string,
  type: string,
  paperCode: string,
  unitNumber: number,
): Promise<string> {
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
  return typeof syllabusDoc?.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
}

async function writeCachedNotes(
  paperCode: string,
  unitNumber: number,
  markdown: string,
  syllabusContent: string,
): Promise<void> {
  const db = adminDatabases();
  try {
    // Keep explicit created_at because schema/docs require this field for cache reads and audits.
    const payload = {
      paper_code: paperCode,
      unit_number: unitNumber,
      generated_markdown: markdown,
      syllabus_content: syllabusContent,
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
        const cachedNotes = await readCachedNotes(paperCode, unitNumber);
        if (cachedNotes) {
          const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - usedBefore);
          const cachedSyllabusContent =
            cachedNotes.syllabusContent ??
            (await readSyllabusContent(university, course, type, paperCode, unitNumber));
          controller.enqueue(toSseData({
            event: "done",
            markdown: cachedNotes.markdown,
            model: "cache",
            remaining,
            cached: true,
            syllabus_content: cachedSyllabusContent,
          }));
          closeStream();
          return;
        }

        const quota = await checkAndResetQuotas(user.id);
        if (!isAdminPlus(user.role) && quota.notes_generated_today >= 1) {
          controller.enqueue(toSseData({ event: "error", error: "Daily limit reached for Unit Notes (1/day)." }));
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
          Query.equal("university", university),
          Query.equal("course", course),
          Query.equal("type", type),
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

          let aiResponseText = "";
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

              const result = await runGeminiCompletion({
                apiKey: geminiApiKey,
                prompt,
                maxTokens: 8192,
                temperature: 0.4,
                model,
              });
              const candidate = String(result.content ?? "").trim();
              if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
                aiResponseText = candidate;
                lastTopicError = null;
                break;
              }
              controller.enqueue(toSseData({
                event: "progress",
                status: `Topic ${index + 1} returned a short/empty response. Retrying...`,
                topic,
                index: index + 1,
                total: subTopics.length,
              }));
            } catch (error) {
              if (!(error instanceof GeminiServiceError)) throw error;
              lastTopicError = error;
            }
            if (attempt < TOPIC_MAX_ATTEMPTS) {
              await sleep(EMPTY_RESPONSE_RETRY_MS);
            }
          }

          if (!aiResponseText) {
            if (lastTopicError && !/empty response/i.test(lastTopicError.message)) throw lastTopicError;
            controller.enqueue(toSseData({
              event: "progress",
              status: `Topic ${index + 1} could not be generated after retries. Continuing...`,
              topic,
              index: index + 1,
              total: subTopics.length,
            }));
            const fallbackReason = "the model returned insufficient content after multiple retries.";
            const fallbackMarkdown = [
              `## ${topic}`,
              "",
              `> *Note: ExamArchive could not generate exhaustive notes for this specific sub-topic because ${fallbackReason} Please refer to standard texts for: ${topic}*`,
            ].join("\n");
            if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
            masterMarkdown += fallbackMarkdown;
            await sleep(TOPIC_LOOP_DELAY_MS);
            continue;
          }

          const leakStrippedMarkdown = stripPromptLeakToFirstHeading(aiResponseText);
          const cleanedTopicMarkdown = cleanGeneratedTopicMarkdown(topic, leakStrippedMarkdown);
          const normalizedTopicMarkdown = ensureTopicMarkdownHeader(topic, cleanedTopicMarkdown);
          if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
          masterMarkdown += normalizedTopicMarkdown;

          await sleep(TOPIC_LOOP_DELAY_MS);
        }

        await writeCachedNotes(paperCode, unitNumber, masterMarkdown, syllabusContent);

        if (!isAdminPlus(user.role)) {
          await recordGeneration(user.id, todayStr);
          await incrementQuotaCounter(user.id, "notes_generated_today");
        }
        const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - (usedBefore + 1));
        controller.enqueue(toSseData({
          event: "done",
          markdown: masterMarkdown,
          model,
          remaining,
          syllabus_content: syllabusContent,
        }));
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

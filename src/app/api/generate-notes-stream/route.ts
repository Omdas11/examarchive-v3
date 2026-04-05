import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { Compression } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  adminDatabases,
  adminStorage,
  COLLECTION,
  DATABASE_ID,
  ID,
  MARKDOWN_CACHE_BUCKET_ID,
  Query,
} from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { runGeminiCompletion } from "@/lib/gemini";
import { readDynamicSystemPrompt } from "@/lib/system-prompt";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";
import { sendGenerationPdfEmail } from "@/lib/generation-notifications";
import { renderMarkdownPdfToAppwrite } from "@/lib/ai-pdf-pipeline";

const EMPTY_RESPONSE_RETRY_MS = 2000;
const TOPIC_LOOP_DELAY_MS = 7000;
const MIN_TOPIC_RESPONSE_CHARS = 50;
const TOPIC_RETRY_MAX = 4;
const RETRY_ERROR_DELAY_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 15000;
const UNIT_NOTES_CACHE_TYPE = "unit_notes";
const COMPLETED_STATUS = "completed";
const ATTRIBUTE_AVAILABILITY_POLL_INTERVAL_MS = 300;
const ATTRIBUTE_AVAILABILITY_TIMEOUT_MS = 12000;
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

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

const ABBREV_DOT_RE = /\b(vs|etc|i\.e|e\.g|cf|al|dr|prof|mr|mrs|ms|st|nd)\./gi;
const ABBREV_PLACEHOLDER = "\x00";

function splitSyllabusIntoSubTopics(syllabusContent: string): string[] {
  const protected_ = syllabusContent.replace(
    ABBREV_DOT_RE,
    (m) => m.slice(0, -1) + ABBREV_PLACEHOLDER,
  );
  return protected_
    .split(/(?<=[.;])\s+/)
    .map((part) =>
      part.replace(/\x00/g, ".").replace(/\s+/g, " ").trim(),
    )
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

function getAppwriteErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = "code" in error ? (error as { code?: unknown }).code : null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function ensureNotesCacheSchema(): Promise<void> {
  const db = adminDatabases();
  const waitForAttributeAvailable = async (key: string): Promise<void> => {
    const deadline = Date.now() + ATTRIBUTE_AVAILABILITY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const attribute = await db.getAttribute(DATABASE_ID, COLLECTION.generated_notes_cache, key);
        if (attribute.status === "available") return;
        if (attribute.status === "failed" || attribute.status === "stuck") {
          throw new Error(
            `[generate-notes-stream] Attribute ${key} failed to build with status=${attribute.status}: ${attribute.error || "unknown error"}`,
          );
        }
      } catch (error) {
        const code = getAppwriteErrorCode(error);
        if (code !== 404) {
          throw error;
        }
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      await sleep(Math.min(ATTRIBUTE_AVAILABILITY_POLL_INTERVAL_MS, remainingMs));
    }
    throw new Error(`[generate-notes-stream] Timed out waiting for attribute ${key} to become available.`);
  };

  const ensureAttribute = async (key: string, create: () => Promise<unknown>) => {
    try {
      const attribute = await db.getAttribute(DATABASE_ID, COLLECTION.generated_notes_cache, key);
      if (attribute.status !== "available") {
        await waitForAttributeAvailable(key);
      }
      return;
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      if (code !== 400 && code !== 404) {
        throw error;
      }
    }

    try {
      await create();
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      if (code !== 409) throw error;
    }
    await waitForAttributeAvailable(key);
  };

  await ensureAttribute("type", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "type",
      50,
      true,
      UNIT_NOTES_CACHE_TYPE,
    ),
  );
  await ensureAttribute("status", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "status",
      50,
      true,
      undefined,
    ),
  );
  await ensureAttribute("year", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "year",
      10,
      false,
      undefined,
    ),
  );
  await ensureAttribute("part_number", () =>
    db.createIntegerAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "part_number",
      false,
      1,
      1000,
      1,
    ),
  );
  await ensureAttribute("markdown_file_id", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "markdown_file_id",
      100,
      false,
      undefined,
    ),
  );
  await ensureAttribute("university", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "university",
      256,
      false,
      undefined,
    ),
  );
  await ensureAttribute("course", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "course",
      64,
      false,
      undefined,
    ),
  );
  await ensureAttribute("stream", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "stream",
      64,
      false,
      undefined,
    ),
  );
  await ensureAttribute("selection_type", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "selection_type",
      32,
      false,
      undefined,
    ),
  );
}

async function ensureMarkdownCacheBucket(): Promise<void> {
  const storage = adminStorage();
  try {
    await storage.getBucket({ bucketId: MARKDOWN_CACHE_BUCKET_ID });
  } catch (error) {
    const code = getAppwriteErrorCode(error);
    if (code !== 404) throw error;
    await storage.createBucket({
      bucketId: MARKDOWN_CACHE_BUCKET_ID,
      name: MARKDOWN_CACHE_BUCKET_ID,
      permissions: [],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 20 * 1024 * 1024,
      allowedFileExtensions: ["md"],
      compression: Compression.None,
      encryption: true,
      antivirus: true,
      transformations: false,
    });
  }
}

async function readCachedNotes(
  university: string,
  course: string,
  stream: string,
  selectionType: string,
  paperCode: string,
  unitNumber: number,
): Promise<CachedNotes | null> {
  const db = adminDatabases();
  const storage = adminStorage();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
      Query.equal("university", university),
      Query.equal("course", course),
      Query.equal("stream", stream),
      Query.equal("selection_type", selectionType),
      Query.equal("paper_code", paperCode),
      Query.equal("unit_number", unitNumber),
      Query.equal("type", UNIT_NOTES_CACHE_TYPE),
      Query.equal("status", COMPLETED_STATUS),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    const markdownFileId = typeof doc.markdown_file_id === "string" ? doc.markdown_file_id.trim() : "";
    if (!markdownFileId) return null;
    const fileBuffer = await storage.getFileDownload(MARKDOWN_CACHE_BUCKET_ID, markdownFileId);
    const markdown = Buffer.from(fileBuffer).toString("utf-8").trim();
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
  stream: string,
  type: string,
  paperCode: string,
  unitNumber: number,
): Promise<string> {
  const db = adminDatabases();
  const syllabusRes = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
    Query.equal("university", university),
    Query.equal("course", course),
    Query.equal("stream", stream),
    Query.equal("type", type),
    Query.equal("paper_code", paperCode),
    Query.equal("unit_number", unitNumber),
    Query.limit(1),
  ]);
  const syllabusDoc = syllabusRes.documents[0];
  return typeof syllabusDoc?.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
}

async function writeCachedNotes(
  university: string,
  course: string,
  stream: string,
  selectionType: string,
  paperCode: string,
  unitNumber: number,
  markdown: string,
  syllabusContent: string,
  log?: (message: string) => void,
): Promise<void> {
  const db = adminDatabases();
  const storage = adminStorage();
  try {
    const mdFileName = `${paperCode}_Unit_${unitNumber}_Cache.md`;
    const inputFile = InputFile.fromBuffer(
      Buffer.from(markdown, "utf-8"),
      mdFileName,
    );
    const uploadResult = await storage.createFile(MARKDOWN_CACHE_BUCKET_ID, ID.unique(), inputFile);
    const markdownFileId = String(uploadResult.$id);
    // Keep explicit created_at because schema/docs require this field for cache reads and audits.
    const payload = {
      university,
      course,
      stream,
      selection_type: selectionType,
      paper_code: paperCode,
      unit_number: unitNumber,
      type: UNIT_NOTES_CACHE_TYPE,
      status: COMPLETED_STATUS,
      markdown_file_id: markdownFileId,
      syllabus_content: syllabusContent,
      created_at: new Date().toISOString(),
    };
    await db.createDocument(DATABASE_ID, COLLECTION.generated_notes_cache, ID.unique(), payload);
    log?.("Markdown cache saved successfully.");
  } catch (error) {
    console.error("[generate-notes-stream] Failed to write cache:", error);
    log?.("Warning: Could not save markdown cache.");
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

async function runRateLimitCountdown(params: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  topic: string;
  index: number;
  total: number;
}): Promise<void> {
  for (let remainingSeconds = 60; remainingSeconds > 5; remainingSeconds -= 5) {
    params.controller.enqueue(toSseData({
      event: "progress",
      status: `Rate limit (TPM) active. Cooling down... resuming in ${remainingSeconds} seconds.`,
      topic: params.topic,
      index: params.index,
      total: params.total,
    }));
    params.controller.enqueue(toSseData({
      log: `Rate limit (TPM) active. Cooling down... resuming in ${remainingSeconds} seconds.`,
    }));
    await sleep(5000);
  }
  params.controller.enqueue(toSseData({
    event: "progress",
    status: "Rate limit (TPM) active. Cooling down... resuming in 5 seconds.",
    topic: params.topic,
    index: params.index,
    total: params.total,
  }));
  params.controller.enqueue(toSseData({
    log: "Rate limit (TPM) active. Cooling down... resuming in 5 seconds.",
  }));
  await sleep(5000);
  params.controller.enqueue(toSseData({
    log: "Cooldown complete. Retrying chunk...",
  }));
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = "status" in error ? (error as { status?: unknown }).status : null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getErrorStatusFromMessage(message: string): number | null {
  const match = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 400 && parsed <= 599 ? parsed : null;
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

  const { searchParams } = new URL(request.url);
  const university = (searchParams.get("university") || "Assam University").trim();
  const course = (searchParams.get("course") || "").trim();
  const streamName = (searchParams.get("stream") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const paperCode = (searchParams.get("paperCode") || "").trim();
  const unitNumber = Number(searchParams.get("unitNumber"));
  const azureGotenbergUrl = process.env.AZURE_GOTENBERG_URL;

  if (!course || !streamName || !type || !paperCode || !Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
    return NextResponse.json({ error: "Invalid selection. Please choose course, stream, type, paper code, and unit 1-5." }, { status: 400 });
  }
  if (!azureGotenbergUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration: AZURE_GOTENBERG_URL is missing." },
      { status: 503 },
    );
  }

  await ensureNotesCacheSchema();
  await ensureMarkdownCacheBucket();
  const completedCache = await readCachedNotes(university, course, streamName, type, paperCode, unitNumber);
  if (completedCache) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyLimit = getDailyLimit();
    const usedBefore = isAdminPlus(user.role) ? 0 : await getDailyCount(user.id, todayStr);
    const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - usedBefore);
    const cachedSyllabusContent =
      completedCache.syllabusContent ??
      (await readSyllabusContent(university, course, streamName, type, paperCode, unitNumber));
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(toSseData({
          event: "done",
          markdown: completedCache.markdown,
          model: "cache",
          cached: true,
          remaining,
          syllabus_content: cachedSyllabusContent,
        }));
        controller.close();
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
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) return NextResponse.json({ error: "Google Gemini is not configured." }, { status: 503 });

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
          Query.equal("stream", streamName),
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
          Query.equal("stream", streamName),
          Query.equal("type", type),
          Query.equal("paper_code", paperCode),
          Query.limit(500),
        ]);
        const formattedQuestions = formatQuestionsForPrompt(questionsRes.documents, unitNumber);
        const systemPrompt = readDynamicSystemPrompt({
          routePath: request.nextUrl.pathname,
          promptType: "unit_notes",
        });
        let masterMarkdown = "";
        const model = GEMINI_MODEL;
        const geminiMaxTokens = 4000;

        for (const [index, topic] of subTopics.entries()) {
          controller.enqueue(toSseData({
            event: "progress",
            status: `Generating topic ${index + 1} of ${subTopics.length}...`,
            topic,
            index: index + 1,
            total: subTopics.length,
          }));

          const promptBody = `University: ${university}
Course: ${course}
Stream: ${streamName}
Type: ${type}
Paper Code: ${paperCode}
Unit Number: ${unitNumber}
Unit Tags: ${syllabusTags.length > 0 ? syllabusTags.join(", ") : "N/A"}

Current Sub-Topic:
${topic}

All Questions for this Unit:
${formattedQuestions || "No related questions found."}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write "Unit ${unitNumber}" or repeat the paper code as heading text.
2. Do NOT use numeric prefixes for main headings (e.g. avoid "1. Heading").
3. Start directly with a ## or ### heading for this sub-topic.
`;

          let aiResponseText = "";
          let retries = 0;
          let hasReceivedShortResponse = false;

          while (retries < TOPIC_RETRY_MAX) {
            try {
              if (retries > 0) {
                controller.enqueue(toSseData({
                  event: "progress",
                  status: `Retrying topic ${index + 1} of ${subTopics.length} (attempt ${retries + 1}/${TOPIC_RETRY_MAX})...`,
                  topic,
                  index: index + 1,
                  total: subTopics.length,
                }));
              }

              let candidate = "";
              try {
                const result = await runGeminiCompletion({
                  apiKey: String(geminiApiKey),
                  prompt: `${systemPrompt}\n\n${promptBody}`,
                  maxTokens: geminiMaxTokens,
                  temperature: 0.4,
                  model,
                });
                candidate = String(result.content ?? "").trim();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error ?? "Google request failed");
                const status = getErrorStatus(error) ?? getErrorStatusFromMessage(errorMessage) ?? 503;
                throw new Error(`Google request failed (status ${status}): ${errorMessage}`);
              }
              if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
                aiResponseText = candidate;
                break;
              }
              if (candidate.length > 0) hasReceivedShortResponse = true;
              controller.enqueue(toSseData({
                event: "progress",
                status: `Topic ${index + 1} returned a short/empty response. Retrying...`,
                topic,
                index: index + 1,
                total: subTopics.length,
              }));
            } catch (error) {
              if (isRateLimitError(error)) {
                await runRateLimitCountdown({
                  controller,
                  topic,
                  index: index + 1,
                  total: subTopics.length,
                });
              } else {
                const errorStatus = getErrorStatus(error);
                const messageStatus =
                  error instanceof Error ? getErrorStatusFromMessage(error.message) : null;
                if (
                  (errorStatus !== null && errorStatus >= 500) ||
                  (messageStatus !== null && messageStatus >= 500)
                ) {
                  await sleep(RETRY_ERROR_DELAY_MS);
                } else {
                  console.error("[generate-notes-stream] Gemini API error:", error);
                  await sleep(RETRY_ERROR_DELAY_MS);
                }
              }
            }
            retries += 1;
            if (retries < TOPIC_RETRY_MAX) {
              await sleep(hasReceivedShortResponse ? EMPTY_RESPONSE_RETRY_MS : RETRY_ERROR_DELAY_MS);
            }
          }

          if (!aiResponseText) {
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

        await writeCachedNotes(university, course, streamName, type, paperCode, unitNumber, masterMarkdown, syllabusContent, (message) =>
          controller.enqueue(toSseData({ log: message })),
        );
        controller.enqueue(toSseData({ log: "AI generation complete. Sending to Azure for PDF rendering..." }));
        let pdfUrl: string | null = null;
        try {
          controller.enqueue(toSseData({ log: "Sending HTML payload to Azure Gotenberg..." }));
          const dynamicPdfName = `${paperCode}_Unit_${unitNumber}_Notes.pdf`;
          const rendered = await renderMarkdownPdfToAppwrite({
            markdown: masterMarkdown,
            fileBaseName: `${paperCode}_unit_${unitNumber}_${Date.now()}`,
            fileName: dynamicPdfName,
            gotenbergUrl: azureGotenbergUrl,
            paperCode,
            unitNumber,
            syllabusContent,
          });
          pdfUrl = rendered.fileUrl;
          controller.enqueue(toSseData({ log: "PDF rendered and uploaded successfully." }));
        } catch (pdfError) {
          console.error("[generate-notes-stream] PDF Engine Error:", pdfError);
          const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          controller.enqueue(toSseData({ log: `Pipeline Error: ${pipelineMessage}` }));
        }

        if (typeof user.email === "string" && user.email.trim().length > 0) {
          try {
            if (pdfUrl) {
              await sendGenerationPdfEmail({
                email: user.email,
                downloadUrl: pdfUrl,
                title: `Unit Notes (${paperCode} - Unit ${unitNumber})`,
              });
            }
          } catch (emailError) {
            console.error("[generate-notes-stream] Failed to send generation email:", emailError);
          }
        }

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
          pdf_url: pdfUrl,
        }));
      } catch (error) {
        const errorStatus = getErrorStatus(error);
        const baseMessage = error instanceof Error ? error.message : "Failed to generate notes.";
        const message =
          errorStatus === 429 ? "AI rate limit reached. Please wait a moment and try again." : baseMessage;
        console.error("[generate-notes-stream] Failed:", error);
        controller.enqueue(toSseData({ event: "error", error: message, status: errorStatus ?? undefined }));
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

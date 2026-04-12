import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { runGeminiCompletion } from "@/lib/gemini";
import { readDynamicSystemPrompt } from "@/lib/system-prompt";
import { renderMarkdownPdfToAppwrite } from "@/lib/ai-pdf-pipeline";
import { sendGenerationPdfEmail } from "@/lib/generation-notifications";
import { incrementQuotaCounter } from "@/lib/user-quotas";

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const TOPIC_RETRY_MAX = 3;
const MIN_TOPIC_RESPONSE_CHARS = 50;

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type JobStep = {
  stepIndex: number;
  stepTotal: number;
  stepLabel: string;
};

export type AiGenerationJobView = {
  id: string;
  status: JobStatus;
  progressPercent: number;
  resultNoteId: string | null;
  errorMessage: string | null;
  paperCode: string;
  unitNumber: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  step: JobStep;
};

export const AI_NOTE_WORKER_FUNCTION_ID = process.env.APPWRITE_AI_NOTE_WORKER_FUNCTION_ID || "ai-note-worker";

type JobInputPayload = {
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  unitNumber: number;
  semester: number | null;
  userEmail: string;
  userName: string;
};

function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return fallback;
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

const ABBREV_DOT_RE = /(?:\d+(?:st|nd|rd|th)|\b(?:vs|etc|i\.e|e\.g|cf|al|dr|prof|mr|mrs|ms|st|nd))\./gi;
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

function deriveStep(status: string, progressPercent: number): JobStep {
  if (status === "queued") return { stepIndex: 1, stepTotal: 5, stepLabel: "Queued for generation" };
  if (status === "completed") return { stepIndex: 5, stepTotal: 5, stepLabel: "Completed and delivered" };
  if (status === "failed" || status === "cancelled") return { stepIndex: 5, stepTotal: 5, stepLabel: "Generation failed" };
  if (progressPercent < 20) return { stepIndex: 2, stepTotal: 5, stepLabel: "Preparing generation context" };
  if (progressPercent < 70) return { stepIndex: 3, stepTotal: 5, stepLabel: "Generating notes content" };
  if (progressPercent < 90) return { stepIndex: 4, stepTotal: 5, stepLabel: "Rendering PDF" };
  return { stepIndex: 5, stepTotal: 5, stepLabel: "Finalizing and notifying" };
}

export function mapJobDocument(doc: Record<string, unknown>): AiGenerationJobView {
  const progressPercent = Math.max(0, Math.min(100, toInt(doc.progress_percent, 0)));
  const status = typeof doc.status === "string" ? doc.status : "queued";
  return {
    id: String(doc.$id || ""),
    status: (["queued", "running", "completed", "failed", "cancelled"].includes(status) ? status : "queued") as JobStatus,
    progressPercent,
    resultNoteId: typeof doc.result_note_id === "string" ? doc.result_note_id : null,
    errorMessage: typeof doc.error_message === "string" ? doc.error_message : null,
    paperCode: typeof doc.paper_code === "string" ? doc.paper_code : "",
    unitNumber: toInt(doc.unit_number, 0),
    createdAt: typeof doc.created_at === "string" ? doc.created_at : String(doc.$createdAt || ""),
    startedAt: typeof doc.started_at === "string" ? doc.started_at : null,
    completedAt: typeof doc.completed_at === "string" ? doc.completed_at : null,
    step: deriveStep(status, progressPercent),
  };
}

async function recordGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.ai_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (error) {
    console.error("[ai-generation-worker] Failed to record usage:", error);
  }
}

async function updateJob(jobId: string, payload: Record<string, unknown>) {
  const db = adminDatabases();
  await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, payload);
}

export async function processAiGenerationJob(jobId: string): Promise<void> {
  const db = adminDatabases();
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const azureGotenbergUrl = process.env.AZURE_GOTENBERG_URL;

  if (!geminiApiKey) throw new Error("Google Gemini is not configured.");
  if (!azureGotenbergUrl) throw new Error("Server misconfiguration: AZURE_GOTENBERG_URL is missing.");

  const job = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId);
  const currentStatus = typeof job.status === "string" ? job.status : "queued";
  if (currentStatus === "completed" || currentStatus === "cancelled") return;

  const payloadRaw = typeof job.input_payload_json === "string" ? job.input_payload_json : "{}";
  let payload: JobInputPayload;
  try {
    payload = JSON.parse(payloadRaw) as JobInputPayload;
  } catch {
    throw new Error("Invalid job input payload.");
  }

  const nowIso = new Date().toISOString();
  await updateJob(jobId, { status: "running", progress_percent: 5, started_at: nowIso, error_message: "" });

  try {
    const university = payload.university.trim();
    const course = payload.course.trim();
    const stream = payload.stream.trim();
    const type = payload.type.trim();
    const paperCode = payload.paperCode.trim();
    const unitNumber = toInt(payload.unitNumber, 0);
    const userEmail = payload.userEmail?.trim() || "";

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
    if (!syllabusDoc) throw new Error("No syllabus data found for this unit.");

    const syllabusContent = typeof syllabusDoc.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
    if (!syllabusContent) throw new Error("Syllabus content is empty for this unit.");

    const paperName = typeof syllabusDoc.paper_name === "string" ? syllabusDoc.paper_name.trim() : "";
    const unitNameRaw = typeof syllabusDoc.unit_name === "string"
      ? syllabusDoc.unit_name
      : (typeof syllabusDoc.unit_title === "string" ? syllabusDoc.unit_title : "");
    const unitName = unitNameRaw.trim();

    const subTopics = splitSyllabusIntoSubTopics(syllabusContent);
    if (subTopics.length === 0) throw new Error("No sub-topics found for this unit.");

    const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
      Query.equal("university", university),
      Query.equal("course", course),
      Query.equal("stream", stream),
      Query.equal("type", type),
      Query.equal("paper_code", paperCode),
      Query.limit(500),
    ]);

    const syllabusTags = normalizeTags(syllabusDoc.tags);
    const formattedQuestions = formatQuestionsForPrompt(questionsRes.documents, unitNumber);
    const systemPrompt = readDynamicSystemPrompt({ promptType: "unit_notes" });
    let masterMarkdown = "";

    for (const [index, topic] of subTopics.entries()) {
      const progressBase = 20;
      const progressRange = 50;
      const topicProgress = progressBase + Math.floor(((index + 1) / subTopics.length) * progressRange);
      await updateJob(jobId, { progress_percent: topicProgress, status: "running" });

      const promptBody = `University: ${university}
Course: ${course}
Stream: ${stream}
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
      for (let retries = 0; retries < TOPIC_RETRY_MAX; retries += 1) {
        try {
          const result = await runGeminiCompletion({
            apiKey: geminiApiKey,
            prompt: `${systemPrompt}\n\n${promptBody}`,
            maxTokens: 4000,
            temperature: 0.4,
            model: GEMINI_MODEL,
          });
          const candidate = String(result.content ?? "").trim();
          if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
            aiResponseText = candidate;
            break;
          }
        } catch (error) {
          if (retries >= TOPIC_RETRY_MAX - 1) throw error;
        }
      }

      if (!aiResponseText) {
        const fallbackMarkdown = [
          `## ${topic}`,
          "",
          `> *Note: ExamArchive could not generate exhaustive notes for this specific sub-topic. Please refer to standard texts for: ${topic}*`,
        ].join("\n");
        if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
        masterMarkdown += fallbackMarkdown;
        continue;
      }

      const leakStrippedMarkdown = stripPromptLeakToFirstHeading(aiResponseText);
      const cleanedTopicMarkdown = cleanGeneratedTopicMarkdown(topic, leakStrippedMarkdown);
      const normalizedTopicMarkdown = ensureTopicMarkdownHeader(topic, cleanedTopicMarkdown);
      if (masterMarkdown) masterMarkdown += "\n\n---\n\n";
      masterMarkdown += normalizedTopicMarkdown;
    }

    await updateJob(jobId, { progress_percent: 80, status: "running" });

    const dynamicPdfName = `${paperCode}_Unit_${unitNumber}_Notes.pdf`;
    const rendered = await renderMarkdownPdfToAppwrite({
      markdown: masterMarkdown,
      fileBaseName: `${paperCode}_unit_${unitNumber}_${Date.now()}`,
      fileName: dynamicPdfName,
      gotenbergUrl: azureGotenbergUrl,
      modelName: GEMINI_MODEL,
      generatedAtIso: new Date().toISOString(),
      paperCode,
      paperName,
      unitNumber,
      unitName,
      syllabusContent,
      userEmail: userEmail || undefined,
    });

    await updateJob(jobId, { progress_percent: 95, status: "running", result_note_id: rendered.fileId });

    if (userEmail) {
      await sendGenerationPdfEmail({
        email: userEmail,
        downloadUrl: rendered.fileUrl,
        title: `Unit Notes (${paperCode} - Unit ${unitNumber})`,
      });
    }

    const userId = typeof job.user_id === "string" ? job.user_id : "";
    if (userId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      await recordGeneration(userId, todayStr);
      await incrementQuotaCounter(userId, "notes_generated_today");
    }

    await updateJob(jobId, {
      status: "completed",
      progress_percent: 100,
      completed_at: new Date().toISOString(),
      error_message: "",
      result_note_id: rendered.fileId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate notes.";
    await updateJob(jobId, {
      status: "failed",
      progress_percent: 100,
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 2000),
    });
    throw error;
  }
}

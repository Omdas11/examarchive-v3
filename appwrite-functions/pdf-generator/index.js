/* eslint-disable no-console */
const { Client, Databases, Storage, Query, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const he = require("he");

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL_ID || "gemini-3.1-flash-lite-preview";
const GEMINI_COOLDOWN_MS = 3000;
const LOGICAL_CHUNK_COUNT = 5;

const DATABASE_ID = process.env.DATABASE_ID || "examarchive";
const JOB_COLLECTION_ID = process.env.AI_JOBS_COLLECTION_ID || "ai_generation_jobs";
const SYLLABUS_TABLE_COLLECTION_ID = process.env.SYLLABUS_TABLE_COLLECTION_ID || "Syllabus_Table";
const QUESTIONS_TABLE_COLLECTION_ID = process.env.QUESTIONS_TABLE_COLLECTION_ID || "Questions_Table";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoLogicalChunks(items, chunkCount) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeChunkCount = Math.max(1, Math.min(chunkCount, items.length));
  const baseSize = Math.floor(items.length / safeChunkCount);
  const remainder = items.length % safeChunkCount;
  const chunks = [];
  let start = 0;
  for (let index = 0; index < safeChunkCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const end = start + size;
    chunks.push(items.slice(start, end));
    start = end;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function splitSyllabusIntoSubTopics(syllabusContent) {
  return String(syllabusContent || "")
    .split(/(?:(?<=[.;])\s*|\n{2,})/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function sanitizeHtmlText(value) {
  return he.encode(value ?? "", {
    useNamedReferences: true,
    allowUnsafeSymbols: true,
  });
}

function renderHtmlDocument({ safeTitle, safeParagraphsHtml }) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8"/>',
    `<title>${safeTitle}</title>`,
    "</head>",
    "<body>",
    safeParagraphsHtml,
    "</body>",
    "</html>",
  ].join("");
}

function markdownToSimpleHtml(markdown, title) {
  const safeParagraphsHtml = String(markdown || "")
    .split(/\n{2,}/)
    .map((block) => {
      const escapedBlock = sanitizeHtmlText(block);
      const withSafeLineBreaks = escapedBlock.replaceAll("\n", "<br/>");
      return `<p>${withSafeLineBreaks}</p>`;
    })
    .join("\n");

  return renderHtmlDocument({
    safeTitle: sanitizeHtmlText(title),
    safeParagraphsHtml,
  });
}

function normalizeBearerToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

async function runGeminiCompletion({ apiKey, prompt, model }) {
  const response = await fetch(
    `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.4 },
      }),
    },
  );
  const bodyText = await response.text();
  if (!response.ok) {
    const error = new Error(`Gemini request failed (status ${response.status})`);
    error.status = response.status;
    error.responseBody = bodyText;
    throw error;
  }
  let payload = {};
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
  if (!content) {
    throw new Error("Gemini returned empty content.");
  }
  return content;
}

async function renderWithGotenberg(markdown, fileName) {
  const gotenbergUrl = String(process.env.GOTENBERG_URL || "").trim();
  const gotenbergAuthToken = String(process.env.GOTENBERG_AUTH_TOKEN || "").trim();
  if (!gotenbergUrl) throw new Error("Missing GOTENBERG_URL in function environment.");
  if (!gotenbergAuthToken) throw new Error("Missing GOTENBERG_AUTH_TOKEN in function environment.");

  const html = markdownToSimpleHtml(markdown, fileName);
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");

  const headers = { Authorization: normalizeBearerToken(gotenbergAuthToken) };
  const response = await fetch(`${gotenbergUrl.replace(/\/+$/, "")}/forms/chromium/convert/html`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`Gotenberg request failed (${response.status}): ${bodyText.slice(0, 2000)}`);
  }

  const pdfArrayBuffer = await response.arrayBuffer();
  return Buffer.from(pdfArrayBuffer);
}

async function updateJob(db, jobId, payload) {
  await db.updateDocument(DATABASE_ID, JOB_COLLECTION_ID, jobId, payload);
}

function buildJobTitle(payload) {
  if (payload.jobType === "solved-paper") {
    return `${payload.paperCode}_${payload.year || "latest"}_solved_paper.pdf`;
  }
  return `${payload.paperCode}_Unit_${payload.unitNumber}_Notes.pdf`;
}

async function generateNotesPayload(db, payload) {
  const syllabusRes = await db.listDocuments(DATABASE_ID, SYLLABUS_TABLE_COLLECTION_ID, [
    Query.equal("university", payload.university),
    Query.equal("course", payload.course),
    Query.equal("stream", payload.stream),
    Query.equal("type", payload.type),
    Query.equal("paper_code", payload.paperCode),
    Query.equal("unit_number", payload.unitNumber),
    Query.limit(1),
  ]);
  const syllabusDoc = syllabusRes.documents?.[0];
  if (!syllabusDoc) {
    throw new Error("No syllabus data found for this unit.");
  }

  const syllabusContent = String(syllabusDoc.syllabus_content || "").trim();
  const subTopics = splitSyllabusIntoSubTopics(syllabusContent);
  if (subTopics.length === 0) {
    throw new Error("No sub-topics found for this unit.");
  }

  const chunks = splitIntoLogicalChunks(subTopics, LOGICAL_CHUNK_COUNT);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY.");

  const generated = [];
  for (const [index, topicsChunk] of chunks.entries()) {
    if (index > 0) {
      await sleep(GEMINI_COOLDOWN_MS);
    }
    const prompt = `Create high-quality markdown notes for this university syllabus chunk.

University: ${payload.university}
Course: ${payload.course}
Stream: ${payload.stream}
Type: ${payload.type}
Paper Code: ${payload.paperCode}
Unit Number: ${payload.unitNumber}
Chunk: ${index + 1}/${chunks.length}

Sub-topics:
${topicsChunk.map((topic, i) => `${i + 1}. ${topic}`).join("\n")}

Formatting requirements:
1. Use markdown headings and subheadings.
2. Include concise explanations with examples where relevant.
3. Keep content exam-focused and syllabus-aligned.
4. Do not include a standalone document title.
`;
    const responseText = await runGeminiCompletion({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    generated.push(responseText);
  }

  return generated.join("\n\n---\n\n");
}

async function generateSolvedPaperPayload(db, payload) {
  const questionsRes = await db.listDocuments(DATABASE_ID, QUESTIONS_TABLE_COLLECTION_ID, [
    Query.equal("university", payload.university),
    Query.equal("course", payload.course),
    Query.equal("stream", payload.stream),
    Query.equal("type", payload.type),
    Query.equal("paper_code", payload.paperCode),
    Query.equal("year", payload.year),
    Query.orderAsc("question_no"),
    Query.limit(500),
  ]);
  const questions = (questionsRes.documents || []).filter(
    (doc) => typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
  );
  if (questions.length === 0) {
    throw new Error("No questions found for this paper/year.");
  }

  const chunks = splitIntoLogicalChunks(questions, LOGICAL_CHUNK_COUNT);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY.");

  const solved = [];
  for (const [index, questionsChunk] of chunks.entries()) {
    if (index > 0) {
      await sleep(GEMINI_COOLDOWN_MS);
    }
    const prompt = `Answer all questions below in markdown.

University: ${payload.university}
Course: ${payload.course}
Stream: ${payload.stream}
Type: ${payload.type}
Paper Code: ${payload.paperCode}
Year: ${payload.year}
Chunk: ${index + 1}/${chunks.length}

Questions:
${questionsChunk.map((questionDoc, qIndex) => {
  const qNo = String(questionDoc.question_no || qIndex + 1).trim();
  const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
  const marks = questionDoc.marks ?? "N/A";
  const content = String(questionDoc.question_content || "").trim();
  return `Q${qNo}${qSub ? `(${qSub})` : ""} [${marks} marks]\n${content}`;
}).join("\n\n")}

Formatting requirements:
1. Answer every question in this chunk.
2. Use clear markdown headings by question.
3. Keep explanations exam-focused and concise.
4. Do not add a top-level document title.
`;
    const responseText = await runGeminiCompletion({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    solved.push(responseText);
  }
  return solved.join("\n\n---\n\n");
}

async function processGenerationJob(rawInput) {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new Databases(client);
  const storage = new Storage(client);

  const parsed = typeof rawInput === "string" && rawInput.trim()
    ? JSON.parse(rawInput)
    : (rawInput || {});
  const jobId = String(parsed.jobId || "").trim();
  const payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : parsed;
  if (!jobId) throw new Error("Missing jobId in function payload.");

  await updateJob(db, jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    progress_percent: 10,
    error_message: "",
  });

  try {
    const normalizedJobType = String(payload.jobType || "").trim().toLowerCase();
    let markdown = "";
    if (normalizedJobType === "notes") {
      markdown = await generateNotesPayload(db, payload);
    } else if (normalizedJobType === "solved-paper") {
      markdown = await generateSolvedPaperPayload(db, payload);
    } else {
      throw new Error(`Unsupported jobType "${payload.jobType}".`);
    }
    await updateJob(db, jobId, { progress_percent: 80 });

    const fileName = buildJobTitle(payload);
    const pdfBuffer = await renderWithGotenberg(markdown, fileName);
    const created = await storage.createFile(
      PAPERS_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, fileName),
    );

    await updateJob(db, jobId, {
      status: "completed",
      progress_percent: 100,
      result_note_id: String(created.$id),
      completed_at: new Date().toISOString(),
    });

    return { ok: true, jobId, fileId: String(created.$id) };
  } catch (error) {
    await updateJob(db, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: String(error?.message || error).slice(0, 2000),
    }).catch(() => {});
    throw error;
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const rawInput = req?.body || process.env.APPWRITE_FUNCTION_EVENT_DATA || process.env.APPWRITE_FUNCTION_DATA || "{}";
    const result = await processGenerationJob(rawInput);
    if (typeof log === "function") log(`[pdf-generator] completed job ${result.jobId}`);
    if (res && typeof res.json === "function") {
      return res.json(result);
    }
    return result;
  } catch (err) {
    if (typeof error === "function") error(err?.stack || String(err));
    if (res && typeof res.json === "function") {
      return res.json({ ok: false, message: String(err?.message || err) }, 500);
    }
    throw err;
  }
};

module.exports.processGenerationJob = processGenerationJob;

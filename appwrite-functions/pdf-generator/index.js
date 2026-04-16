/* eslint-disable no-console */
const { Client, Databases, Storage, Query, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const katex = require("katex");
const sanitizeHtml = require("sanitize-html");
const he = require("he");

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL_ID || "gemini-3.1-flash-lite-preview";
const GEMINI_COOLDOWN_MS = 3000;
const LOGICAL_CHUNK_COUNT = 5;
const geminiRequestTimeoutRaw = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const geminiMaxAttemptsRaw = Number(process.env.GEMINI_MAX_ATTEMPTS);
const geminiBaseBackoffRaw = Number(process.env.GEMINI_BASE_BACKOFF_MS);
const gotenbergRequestTimeoutRaw = Number(process.env.GOTENBERG_REQUEST_TIMEOUT_MS);
const gotenbergMaxAttemptsRaw = Number(process.env.GOTENBERG_MAX_ATTEMPTS);
const gotenbergBaseBackoffRaw = Number(process.env.GOTENBERG_BASE_BACKOFF_MS);
const tavilyTimeoutRaw = Number(process.env.TAVILY_TIMEOUT_MS);
const GEMINI_REQUEST_TIMEOUT_MS = Number.isFinite(geminiRequestTimeoutRaw)
  ? Math.max(1_000, geminiRequestTimeoutRaw)
  : 45_000;
const DEFAULT_GEMINI_MAX_ATTEMPTS = Number.isInteger(geminiMaxAttemptsRaw)
  ? Math.max(1, geminiMaxAttemptsRaw)
  : 3;
const DEFAULT_GEMINI_BASE_BACKOFF_MS = Number.isFinite(geminiBaseBackoffRaw)
  ? Math.max(250, geminiBaseBackoffRaw)
  : 1500;
const GOTENBERG_ENDPOINT_PATH = "/forms/chromium/convert/html";
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";
const GOTENBERG_REQUEST_TIMEOUT_MS = Number.isFinite(gotenbergRequestTimeoutRaw)
  ? Math.max(1_000, gotenbergRequestTimeoutRaw)
  : 45_000;
const GOTENBERG_MAX_ATTEMPTS = Number.isInteger(gotenbergMaxAttemptsRaw)
  ? Math.max(1, gotenbergMaxAttemptsRaw)
  : 3;
const GOTENBERG_BASE_BACKOFF_MS = Number.isFinite(gotenbergBaseBackoffRaw)
  ? Math.max(250, gotenbergBaseBackoffRaw)
  : 1500;
const TAVILY_TIMEOUT_MS = Number.isFinite(tavilyTimeoutRaw)
  ? Math.max(1_000, tavilyTimeoutRaw)
  : 8_000;

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
  return he.encode(value ?? "");
}

function wrapHtmlTag(tagName, safeInnerHtml) {
  return ["<", tagName, ">", safeInnerHtml, "</", tagName, ">"].join("");
}

const PDF_DOCUMENT_STYLES = [
  "body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; margin: 40px; line-height: 1.7; font-size: 15px; }",
  "h1, h2, h3, h4, h5, h6 { color: #0f172a; margin: 1.2em 0 0.5em; line-height: 1.3; }",
  "h1 { font-size: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }",
  "h2 { font-size: 22px; }",
  "h3 { font-size: 18px; }",
  "p, ul, ol, blockquote { margin: 0.7em 0; }",
  "code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 4px; }",
  "pre { background: #0b1020; color: #f8fafc; padding: 14px; border-radius: 8px; overflow-x: auto; }",
  "blockquote { border-left: 4px solid #cbd5e1; padding-left: 12px; color: #334155; }",
  ".watermark { position: fixed; right: 20px; bottom: 14px; font-size: 11px; color: #64748b; opacity: 0.65; }",
  ".katex-display { margin: 1em 0; }",
].join("");

function renderLatexMathMl(markdown) {
  const source = String(markdown || "");
  return source
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expression) => katex.renderToString(String(expression).trim(), {
      throwOnError: false,
      displayMode: true,
      output: "mathml",
    }))
    .replace(/\$([^\n$]+?)\$/g, (_, expression) => katex.renderToString(String(expression).trim(), {
      throwOnError: false,
      displayMode: false,
      output: "mathml",
    }));
}

function sanitizeGeneratedHtml(input) {
  return sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "img",
      "span",
      "math",
      "semantics",
      "mrow",
      "mi",
      "mo",
      "mn",
      "msup",
      "msub",
      "msubsup",
      "mfrac",
      "msqrt",
      "mroot",
      "munder",
      "mover",
      "munderover",
      "mspace",
      "mstyle",
      "mtext",
      "mphantom",
      "mpadded",
      "menclose",
      "mtable",
      "mtr",
      "mtd",
      "annotation",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["class"],
      math: ["xmlns", "display"],
      annotation: ["encoding"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["data"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
  });
}

function renderHtmlDocument({ safeTitle, safeParagraphsHtml }) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8"/>',
    wrapHtmlTag("title", safeTitle),
    wrapHtmlTag("style", PDF_DOCUMENT_STYLES),
    "</head>",
    "<body>",
    safeParagraphsHtml,
    '<div class="watermark">Generated by ExamArchive AI</div>',
    "</body>",
    "</html>",
  ].join("");
}

let markedParserPromise = null;

function assertMarkedParser(parserCandidate) {
  if (!parserCandidate || typeof parserCandidate.parse !== "function") {
    throw new Error("Invalid marked parser: expected an object with a parse() function.");
  }
  return parserCandidate;
}

async function loadMarkedParser() {
  if (!markedParserPromise) {
    markedParserPromise = import("marked").then((module) => assertMarkedParser(module.marked));
  }
  return markedParserPromise;
}

async function markdownToSimpleHtml(markdown, title, markedParser) {
  const markdownWithMathMl = renderLatexMathMl(markdown);
  const htmlFromMarkdown = markedParser.parse(markdownWithMathMl, { gfm: true, breaks: true });
  const safeParagraphsHtml = sanitizeGeneratedHtml(String(htmlFromMarkdown || ""));

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
  let response;
  try {
    response = await fetch(
      `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    const isTimeout = error && typeof error === "object" && error.name === "TimeoutError";
    const requestError = new Error(
      isTimeout
        ? `Gemini request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms.`
        : `Gemini request failed: ${String(error?.message || error)}`,
    );
    requestError.code = isTimeout ? "GEMINI_TIMEOUT" : "GEMINI_REQUEST_FAILED";
    throw requestError;
  }
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

function isRetryableGeminiStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function runGeminiCompletionWithRetry({ apiKey, prompt, model }) {
  let lastError = null;
  for (let attempt = 1; attempt <= DEFAULT_GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runGeminiCompletion({ apiKey, prompt, model });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const canRetry = isRetryableGeminiStatus(status) || !status;
      if (!canRetry || attempt >= DEFAULT_GEMINI_MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(DEFAULT_GEMINI_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error("Gemini generation failed.");
}

function getNotesSystemPrompt() {
  return String(process.env.UNIT_NOTES_SYSTEM_PROMPT || "").trim() || [
    "Create high-quality markdown notes for this university syllabus chunk.",
    "Use markdown headings and subheadings.",
    "Include concise explanations with examples where relevant.",
    "Keep content exam-focused and syllabus-aligned.",
    "Do not include a standalone document title.",
  ].join("\n");
}

function getSolvedPaperSystemPrompt() {
  return String(process.env.SOLVED_PAPER_SYSTEM_PROMPT || "").trim() || [
    "Answer all questions below in markdown.",
    "Answer every question in this chunk.",
    "Use clear markdown headings by question.",
    "Keep explanations exam-focused and concise.",
    "Do not add a top-level document title.",
  ].join("\n");
}

async function fetchTavilyContext(query) {
  const tavilyApiKey = String(process.env.TAVILY_API_KEY || "").trim();
  if (!tavilyApiKey || !query.trim()) {
    return "";
  }

  let response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
  } catch {
    return "";
  }
  if (!response.ok) {
    return "";
  }
  const payload = await response.json().catch(() => null);
  const answer = typeof payload?.answer === "string" ? payload.answer.trim() : "";
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const snippets = results
    .slice(0, 5)
    .map((item, index) => {
      const title = typeof item?.title === "string" ? item.title.trim() : `Result ${index + 1}`;
      const content = typeof item?.content === "string" ? item.content.trim() : "";
      const url = typeof item?.url === "string" ? item.url.trim() : "";
      return [title, content, url ? `Source: ${url}` : ""].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  return [answer ? `Summary:\n${answer}` : "", snippets ? `References:\n${snippets}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function validateGotenbergUrl(raw) {
  let baseUrl;
  try {
    baseUrl = new URL(raw);
  } catch {
    throw new Error("Invalid GOTENBERG_URL in function environment.");
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error("GOTENBERG_URL must use HTTPS.");
  }
  if (!baseUrl.hostname.toLowerCase().endsWith(TRUSTED_GOTENBERG_HOST_SUFFIX)) {
    throw new Error(`GOTENBERG_URL must target a trusted ${TRUSTED_GOTENBERG_HOST_SUFFIX} host.`);
  }
  const endpointUrl = new URL(GOTENBERG_ENDPOINT_PATH, `${baseUrl.origin}/`);
  return endpointUrl.toString();
}

function shouldRetryGotenberg(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function renderWithGotenberg(markdown, fileName, markedParser) {
  const gotenbergUrl = String(process.env.GOTENBERG_URL || "").trim();
  const gotenbergAuthToken = String(process.env.GOTENBERG_AUTH_TOKEN || "").trim();
  if (!gotenbergUrl) throw new Error("Missing GOTENBERG_URL in function environment.");
  if (!gotenbergAuthToken) throw new Error("Missing GOTENBERG_AUTH_TOKEN in function environment.");
  const endpointUrl = validateGotenbergUrl(gotenbergUrl);

  const html = await markdownToSimpleHtml(markdown, fileName, markedParser);
  const headers = { Authorization: normalizeBearerToken(gotenbergAuthToken) };

  let lastError = null;
  for (let attempt = 1; attempt <= GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
    const form = new FormData();
    form.append("files", new Blob([html], { type: "text/html" }), "index.html");
    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(GOTENBERG_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        const msg = `Gotenberg request failed (${response.status}): ${bodyText.slice(0, 2000)}`;
        if (attempt < GOTENBERG_MAX_ATTEMPTS && shouldRetryGotenberg(response.status)) {
          console.error(`[pdf-generator] ${msg}`);
          await sleep(GOTENBERG_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
          continue;
        }
        const httpError = new Error(msg);
        httpError.name = "GotenbergHttpError";
        throw httpError;
      }
      const pdfArrayBuffer = await response.arrayBuffer();
      return Buffer.from(pdfArrayBuffer);
    } catch (error) {
      lastError = error;
      const isTimeout = error && typeof error === "object" && error.name === "TimeoutError";
      const isHttpError = error && typeof error === "object" && error.name === "GotenbergHttpError";
      if (attempt >= GOTENBERG_MAX_ATTEMPTS) {
        break;
      }
      if (isHttpError) {
        console.error(
          `[pdf-generator] Gotenberg non-retryable HTTP error at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}: ${formatWorkerErrorMessage(error)}`,
        );
        throw error;
      }
      if (isTimeout) {
        console.error(`[pdf-generator] Gotenberg timeout at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}`);
      } else {
        console.error(
          `[pdf-generator] Gotenberg request error at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}: ${formatWorkerErrorMessage(error)}`,
        );
      }
      await sleep(GOTENBERG_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error("Gotenberg request failed.");
}

function formatWorkerErrorMessage(error) {
  if (!(error instanceof Error)) return String(error).slice(0, 2000);
  const details = [error.message];
  if (typeof error.code !== "undefined") details.push(`code=${String(error.code)}`);
  if (typeof error.status !== "undefined") details.push(`status=${String(error.status)}`);
  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    details.push(`cause=${cause.message}`);
  }
  return details.filter(Boolean).join(" | ").slice(0, 2000);
}

function parseFunctionInput(rawInput) {
  if (rawInput === null || typeof rawInput === "undefined") return {};
  if (typeof rawInput === "object") return rawInput;
  if (typeof rawInput !== "string") {
    throw new Error("Function payload must be an object or JSON string.");
  }
  const trimmed = rawInput.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Function payload must be valid JSON.");
  }
}

function isBodyWrappedPayload(value) {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && !value.jobId
    && !value.payload
    && Object.hasOwn(value, "body")
  );
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
    const prompt = `${getNotesSystemPrompt()}

University: ${payload.university}
Course: ${payload.course}
Stream: ${payload.stream}
Type: ${payload.type}
Paper Code: ${payload.paperCode}
Unit Number: ${payload.unitNumber}
Chunk: ${index + 1}/${chunks.length}

Sub-topics:
${topicsChunk.map((topic, i) => `${i + 1}. ${topic}`).join("\n")}
`;
    const responseText = await runGeminiCompletionWithRetry({
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
  const tavilyContext = await fetchTavilyContext(
    `${payload.university} ${payload.course} ${payload.paperCode} ${payload.year} solved paper key points`,
  );

  const solved = [];
  for (const [index, questionsChunk] of chunks.entries()) {
    if (index > 0) {
      await sleep(GEMINI_COOLDOWN_MS);
    }
    const prompt = `${getSolvedPaperSystemPrompt()}

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
${tavilyContext ? `\n\nWeb context (Tavily):\n${tavilyContext}` : ""}
`;
    const responseText = await runGeminiCompletionWithRetry({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    solved.push(responseText);
  }
  return solved.join("\n\n---\n\n");
}

async function processGenerationJob(rawInput, options = {}) {
  const markedParser = Object.hasOwn(options, "markedParser")
    ? assertMarkedParser(options.markedParser)
    : await loadMarkedParser();
  const endpoint = String(process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new Databases(client);
  const storage = new Storage(client);

  const outer = parseFunctionInput(rawInput);
  const parsed = isBodyWrappedPayload(outer)
    ? parseFunctionInput(outer.body)
    : outer;
  const jobId = String(parsed.jobId || "").trim();
  const payload = typeof parsed.payload === "string"
    ? parseFunctionInput(parsed.payload)
    : (parsed.payload && typeof parsed.payload === "object" ? parsed.payload : parsed);
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
    const pdfBuffer = await renderWithGotenberg(markdown, fileName, markedParser);
    const created = await storage.createFile(
      PAPERS_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, fileName),
    );

    await updateJob(db, jobId, {
      status: "completed",
      progress_percent: 100,
      result_file_id: String(created.$id),
      completed_at: new Date().toISOString(),
    });

    return { ok: true, jobId, fileId: String(created.$id) };
  } catch (error) {
    await updateJob(db, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: formatWorkerErrorMessage(error),
    }).catch(() => {});
    throw error;
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const { marked } = await import("marked");
    const rawInput = req?.body || process.env.APPWRITE_FUNCTION_EVENT_DATA || process.env.APPWRITE_FUNCTION_DATA || "{}";
    const result = await processGenerationJob(rawInput, { markedParser: marked });
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

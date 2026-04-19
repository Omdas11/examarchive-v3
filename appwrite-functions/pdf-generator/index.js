/* eslint-disable no-console */
const { Client, Databases, Storage, Query, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const { randomInt } = require("node:crypto");

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL_ID || "gemini-3.1-flash-lite-preview";
const GEMINI_COOLDOWN_MS = 3000;
const LOGICAL_CHUNK_COUNT = 5;
const geminiRequestTimeoutRaw = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const geminiMaxAttemptsRaw = Number(process.env.GEMINI_MAX_ATTEMPTS);
const geminiBaseBackoffRaw = Number(process.env.GEMINI_BASE_BACKOFF_MS);
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
const TAVILY_TIMEOUT_MS = Number.isFinite(tavilyTimeoutRaw)
  ? Math.max(1_000, tavilyTimeoutRaw)
  : 8_000;

const DATABASE_ID = process.env.DATABASE_ID || "examarchive";
const JOB_COLLECTION_ID = process.env.AI_JOBS_COLLECTION_ID || "ai_generation_jobs";
const SYLLABUS_TABLE_COLLECTION_ID = process.env.SYLLABUS_TABLE_COLLECTION_ID || "Syllabus_Table";
const QUESTIONS_TABLE_COLLECTION_ID = process.env.QUESTIONS_TABLE_COLLECTION_ID || "Questions_Table";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";
const CACHED_UNIT_NOTES_BUCKET_ID = process.env.CACHED_UNIT_NOTES_BUCKET_ID || "cached-unit-notes";
const CACHED_SOLVED_PAPERS_BUCKET_ID = process.env.CACHED_SOLVED_PAPERS_BUCKET_ID || "cached-solved-papers";
const NOTIFY_COMPLETION_PATH = "/api/ai/notify-completion";
const NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS = 2_000;
const MAX_LOGGED_CALLBACK_URL_CHARS = 500;
const COMPLETION_WEBHOOK_DELAY_MS = 2_000;
const GOTENBERG_CONVERT_ENDPOINT_PATH = "/forms/chromium/convert/html";
const GOTENBERG_TIMEOUT_MS = 60_000;
const GOTENBERG_MAX_ATTEMPTS = 3;
const GOTENBERG_BASE_BACKOFF_MS = 1_500;
const GOTENBERG_MAX_BACKOFF_MS = 6_000;
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";
const MAX_SAFE_PDF_FILENAME_CORE_LENGTH = 120;

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

function normalizeBearerToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownToBasicHtml(markdown) {
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const htmlLines = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    htmlLines.push("<p>" + paragraph.join(" ") + "</p>");
    paragraph = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      const level = headingMatch[1].length;
      htmlLines.push("<h" + level + ">" + escapeHtml(headingMatch[2]) + "</h" + level + ">");
      return;
    }
    paragraph.push(escapeHtml(trimmed));
  });
  flushParagraph();
  return htmlLines.join("\n");
}

function markdownToPdfHtml(markdown, title) {
  const renderedMarkdown = markdownToBasicHtml(markdown);
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>",
    "<title>" + escapeHtml(title) + "</title>",
    "<style>",
    "body{font-family:Inter,Arial,sans-serif;color:#231515;line-height:1.65;font-size:14px;padding:18mm 14mm;}",
    "h1,h2,h3,h4,h5,h6{color:#800000;line-height:1.35;}",
    "h1{border-bottom:1px solid #e8d8d8;padding-bottom:6px;}",
    "pre{background:#101828;color:#f8fafc;padding:12px;border-radius:6px;overflow:auto;}",
    "code{background:#f4f4f5;padding:0.1em 0.3em;border-radius:4px;}",
    "blockquote{border-left:3px solid #800000;padding-left:10px;color:#6e1111;}",
    "img{max-width:100%;height:auto;}",
    "</style></head><body>",
    "<article>" + renderedMarkdown + "</article>",
    "</body></html>",
  ].join("");
}

function validateGotenbergUrl(rawUrl) {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) {
    throw new Error("Missing GOTENBERG_URL in function environment.");
  }
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Invalid GOTENBERG_URL in function environment.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("GOTENBERG_URL must use HTTPS.");
  }
  const normalizedHost = parsed.hostname.toLowerCase();
  const trustedHostPattern = /^[a-z0-9-]+\.hf\.space$/;
  if (!trustedHostPattern.test(normalizedHost)) {
    throw new Error(`GOTENBERG_URL must target a trusted ${TRUSTED_GOTENBERG_HOST_SUFFIX} host.`);
  }
  return parsed.toString();
}

function normalizeGotenbergWaitDelay(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "5s";
  return /^\d+(?:ms|s|m|h)$/i.test(trimmed) ? trimmed : "5s";
}

function shouldRetryGotenbergStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function normalizeSafePdfCoreName(rawTitle) {
  const rawValue = String(rawTitle || "generated_document");
  const baseValue = rawValue.toLowerCase().endsWith(".pdf")
    ? rawValue.slice(0, -4)
    : rawValue;
  const isAsciiAlphaNumeric = (char) =>
    (char >= "a" && char <= "z")
    || (char >= "A" && char <= "Z")
    || (char >= "0" && char <= "9");
  const mappedChars = [];
  let previousWasUnderscore = false;
  for (const char of baseValue) {
    const normalizedChar = (isAsciiAlphaNumeric(char) || char === "-" || char === "_") ? char : "_";
    if (normalizedChar === "_") {
      if (previousWasUnderscore) continue;
      previousWasUnderscore = true;
      mappedChars.push(normalizedChar);
      continue;
    }
    previousWasUnderscore = false;
    mappedChars.push(normalizedChar);
  }
  let normalized = mappedChars.join("");
  while (normalized.startsWith("_")) normalized = normalized.slice(1);
  while (normalized.endsWith("_")) normalized = normalized.slice(0, -1);
  if (!normalized) normalized = "generated_document";
  return normalized.slice(0, MAX_SAFE_PDF_FILENAME_CORE_LENGTH);
}

async function renderMarkdownToPdfBuffer(markdown, title) {
  const gotenbergUrl = validateGotenbergUrl(process.env.GOTENBERG_URL);
  const gotenbergAuthToken = normalizeBearerToken(process.env.GOTENBERG_AUTH_TOKEN);
  if (!gotenbergAuthToken) {
    throw new Error("Missing GOTENBERG_AUTH_TOKEN in function environment.");
  }

  const html = markdownToPdfHtml(markdown, title);
  const endpoint = new URL(GOTENBERG_CONVERT_ENDPOINT_PATH, gotenbergUrl).toString();
  let lastError = null;

  for (let attempt = 1; attempt <= GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
    try {
      const form = new FormData();
      form.append("files", new Blob([html], { type: "text/html" }), "index.html");
      form.append("printBackground", "true");
      form.append("waitDelay", normalizeGotenbergWaitDelay(process.env.GOTENBERG_WAIT_DELAY));
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: gotenbergAuthToken },
        body: form,
        signal: AbortSignal.timeout(GOTENBERG_TIMEOUT_MS),
      });
      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        const statusError = new Error(
          `Gotenberg request failed (${response.status}): ${responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS)}`,
        );
        statusError.status = response.status;
        throw statusError;
      }
      const pdfArrayBuffer = await response.arrayBuffer();
      return Buffer.from(pdfArrayBuffer);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const canRetry = shouldRetryGotenbergStatus(status) || !status;
      if (!canRetry || attempt >= GOTENBERG_MAX_ATTEMPTS) {
        break;
      }
      const backoffMs = Math.min(
        GOTENBERG_MAX_BACKOFF_MS,
        GOTENBERG_BASE_BACKOFF_MS * attempt,
      );
      await sleep(backoffMs);
    }
  }
  throw lastError || new Error("Failed to render PDF with Gotenberg.");
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

function normalizeAbsoluteHttpUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  // Block malformed "double protocol" values that URL() can parse unexpectedly (e.g. https://https://...).
  if (/^https?:\/\/https?:\/\//i.test(value)) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    const webhookSecret = String(process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
    if (webhookSecret && parsed.protocol !== "https:") {
      console.error("[pdf-generator] Webhook URL rejected: HTTPS required when AI_JOB_WEBHOOK_SECRET is configured.", {
        protocol: parsed.protocol,
        callbackUrl: value.slice(0, MAX_LOGGED_CALLBACK_URL_CHARS),
        truncated: value.length > MAX_LOGGED_CALLBACK_URL_CHARS,
      });
      return "";
    }
    return parsed.toString();
  } catch (error) {
    console.error("[pdf-generator] Invalid completion callback URL received.", {
      callbackUrl: value.slice(0, MAX_LOGGED_CALLBACK_URL_CHARS),
      truncated: value.length > MAX_LOGGED_CALLBACK_URL_CHARS,
      error: String(error?.message || error),
    });
    return "";
  }
}

function buildTrustedSiteUrlFromVercelUrl(rawVercelUrl) {
  const normalizedVercelUrl = String(rawVercelUrl || "").trim().replace(/^https?:\/\//i, "");
  if (!normalizedVercelUrl) return "";
  return normalizeAbsoluteHttpUrl(`https://${normalizedVercelUrl}`);
}

function shouldUsePreviewWebhookUrl({ canonicalUrl, previewUrl, vercelEnv }) {
  if (!previewUrl) return false;
  if (!canonicalUrl) return true;
  if (String(vercelEnv || "").trim().toLowerCase() !== "preview") return false;
  try {
    return new URL(canonicalUrl).origin !== new URL(previewUrl).origin;
  } catch {
    return true;
  }
}

function resolveCallbackBaseSiteUrl() {
  const siteUrl = normalizeAbsoluteHttpUrl(String(process.env.SITE_URL || "").trim());
  const nextPublicSiteUrl = normalizeAbsoluteHttpUrl(String(process.env.NEXT_PUBLIC_SITE_URL || "").trim());
  const canonicalSiteUrl = siteUrl || nextPublicSiteUrl;
  const trustedVercelSiteUrl = buildTrustedSiteUrlFromVercelUrl(
    String(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim(),
  );
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (shouldUsePreviewWebhookUrl({ canonicalUrl: canonicalSiteUrl, previewUrl: trustedVercelSiteUrl, vercelEnv })) {
    return trustedVercelSiteUrl.replace(/\/+$/, "");
  }
  return (canonicalSiteUrl || trustedVercelSiteUrl).replace(/\/+$/, "");
}

function resolveNotifyCompletionUrl(callbackUrl) {
  const callbackOverride = normalizeAbsoluteHttpUrl(callbackUrl);
  if (callbackOverride) {
    // The webhook secret (AI_JOB_WEBHOOK_SECRET) is the authentication layer that
    // protects the notify-completion endpoint. Origin-based restrictions are
    // intentionally omitted here to allow Vercel Preview deployment URLs to
    // deliver webhooks successfully. Log the override URL for audit visibility.
    console.log("[pdf-generator] Using callbackOverride for completion webhook.", { callbackOverride });
    return { url: callbackOverride, reason: "callback_override" };
  }
  const siteUrl = resolveCallbackBaseSiteUrl();
  if (!siteUrl) {
    console.error("[pdf-generator] CRITICAL: No valid base URL found (checked SITE_URL, NEXT_PUBLIC_SITE_URL, and VERCEL_URL); completion webhook cannot be delivered safely.", {
      hasCallbackUrl: false,
    });
    return { url: "", reason: "missing_base_url" };
  }
  try {
    const baseUrl = new URL(siteUrl);
    return { url: new URL(NOTIFY_COMPLETION_PATH, `${baseUrl.toString()}/`).toString(), reason: "site_url" };
  } catch {
    return { url: "", reason: "invalid_site_url" };
  }
}

function getNotifyCompletionUrl(callbackUrl) {
  return resolveNotifyCompletionUrl(callbackUrl).url;
}

async function notifyCompletionWebhook({ jobId, status, fileId, userId, userEmail, callbackUrl }) {
  if (!resolveCallbackBaseSiteUrl()) {
    console.error("[pdf-generator] CRITICAL: No base URL environment variable found (SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL); notify-completion webhook delivery may be skipped.");
  }
  const notifyResolution = resolveNotifyCompletionUrl(callbackUrl);
  const notifyUrl = notifyResolution.url;
  if (!notifyUrl) {
    console.error("[pdf-generator] Completion webhook callback skipped due to URL resolution failure.", {
      reason: notifyResolution.reason,
      hasCallbackUrl: Boolean(String(callbackUrl || "").trim()),
      hasSiteUrl: Boolean(String(process.env.SITE_URL || "").trim()),
      hasNextPublicSiteUrl: Boolean(String(process.env.NEXT_PUBLIC_SITE_URL || "").trim()),
      hasVercelUrl: Boolean(String(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim()),
    });
    return;
  }
  const headers = { "Content-Type": "application/json" };
  const webhookSecret = String(process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
  if (webhookSecret) {
    headers.Authorization = normalizeBearerToken(webhookSecret);
  }
  const callbackPayload = {
    jobId: String(jobId || "").trim(),
    status: String(status || "").trim().toLowerCase(),
    fileId: String(fileId || "").trim(),
  };
  const normalizedUserId = String(userId || "").trim();
  const normalizedUserEmail = String(userEmail || "").trim();
  if (normalizedUserId) {
    callbackPayload.userId = normalizedUserId;
  }
  if (normalizedUserEmail) {
    callbackPayload.userEmail = normalizedUserEmail;
  }

  const maxAttempts = 3;
  const baseBackoffMs = 300;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(notifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(callbackPayload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        console.error("[pdf-generator] Completion webhook request error after all attempts.", {
          url: notifyUrl,
          attempts: maxAttempts,
          message: error instanceof Error ? error.message : String(error),
          error,
        });
        return;
      }
      console.error("[pdf-generator] Completion webhook request error (will retry).", {
        attempt,
        maxAttempts,
        url: notifyUrl,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      const jitter = randomInt(85, 116) / 100;
      const backoffMs = baseBackoffMs * (2 ** (attempt - 1)) * jitter;
      await sleep(backoffMs);
      continue;
    }

    console.log("[pdf-generator] Completion webhook callback response received.", {
      url: notifyUrl,
      status: response.status,
      ok: response.ok,
      attempt,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      const shouldRetry = response.status === 429 || response.status >= 500;
      if (shouldRetry && attempt < maxAttempts) {
        console.error("[pdf-generator] Completion webhook request failed (will retry).", {
          attempt,
          maxAttempts,
          status: response.status,
          body: responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS),
        });
        const jitter = randomInt(85, 116) / 100;
        const backoffMs = baseBackoffMs * (2 ** (attempt - 1)) * jitter;
        await sleep(backoffMs);
        continue;
      }
      console.error("[pdf-generator] Completion webhook request failed after all attempts.", {
        status: response.status,
        body: responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS),
        attempts: attempt,
      });
      return;
    }

    return;
  }
  if (lastError) {
    console.error("[pdf-generator] Completion webhook request failed.", {
      url: notifyUrl,
      message: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
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
    if (normalizedJobType !== "notes" && normalizedJobType !== "solved-paper") {
      throw new Error(`Unsupported jobType "${payload.jobType}".`);
    }

    const normalizeRequiredCacheSegment = (value, fieldName) => {
      const normalizedValue = String(value ?? "").trim();
      if (!normalizedValue) {
        throw new Error(`Missing ${fieldName} in payload for ${normalizedJobType} cache key.`);
      }
      return normalizedValue;
    };
    const normalizeOptionalCacheSegment = (value, fallbackValue) => {
      const normalizedValue = String(value ?? "").trim();
      return normalizedValue.length > 0 ? normalizedValue : fallbackValue;
    };
    const cacheScopeSegment = normalizedJobType === "notes"
      ? normalizeRequiredCacheSegment(payload.unitNumber, "unitNumber")
      : normalizeRequiredCacheSegment(payload.year, "year");
    const cacheKeySegments = [
      normalizeRequiredCacheSegment(payload.paperCode, "paperCode"),
      cacheScopeSegment,
      normalizeRequiredCacheSegment(payload.stream, "stream"),
      normalizeRequiredCacheSegment(payload.course, "course"),
      normalizeRequiredCacheSegment(payload.type, "type"),
      normalizeRequiredCacheSegment(payload.university, "university"),
      normalizeOptionalCacheSegment(payload.semester, "na"),
      normalizeOptionalCacheSegment(payload.model, DEFAULT_MODEL),
    ];
    const cacheKey = cacheKeySegments.join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const legacyCacheKey = [
      normalizeRequiredCacheSegment(payload.paperCode, "paperCode"),
      cacheScopeSegment,
      normalizeRequiredCacheSegment(payload.stream, "stream"),
      normalizeRequiredCacheSegment(payload.course, "course"),
      normalizeRequiredCacheSegment(payload.type, "type"),
    ].join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const cacheFileName = `${cacheKey}.md`;
    const legacyCacheFileName = `${legacyCacheKey}.md`;
    const cacheBucketId = normalizedJobType === "notes"
      ? CACHED_UNIT_NOTES_BUCKET_ID
      : CACHED_SOLVED_PAPERS_BUCKET_ID;
    let loadedFromCache = false;

    let cacheFileId = "";
    try {
      const cachedFiles = await storage.listFiles(cacheBucketId, [
        Query.search("name", cacheKey),
        Query.orderDesc("$createdAt"),
        Query.limit(10),
      ]);
      const exactMatch = Array.isArray(cachedFiles.files)
        ? (
          cachedFiles.files.find((file) => String(file.name || "").trim() === cacheFileName)
          || cachedFiles.files.find((file) => String(file.name || "").trim() === legacyCacheFileName)
        )
        : null;
      const cachedFile = exactMatch;
      if (cachedFile && cachedFile.$id) {
        const cachedMarkdownBuffer = await storage.getFileDownload(cacheBucketId, cachedFile.$id);
        const cachedMarkdown = Buffer.from(cachedMarkdownBuffer).toString("utf8");
        if (cachedMarkdown.trim()) {
          markdown = cachedMarkdown;
          loadedFromCache = true;
          cacheFileId = String(cachedFile.$id);
          console.log("[pdf-generator] Loaded markdown from cache bucket.", {
            jobId,
            jobType: normalizedJobType,
            cacheBucketId,
            cacheFileId,
            cacheFileName: String(cachedFile.name || ""),
          });
        }
      }
    } catch (cacheReadError) {
      console.warn("[pdf-generator] Markdown cache read failed. Proceeding with fresh generation.", {
        jobId,
        jobType: normalizedJobType,
        cacheBucketId,
        cacheKey,
        message: cacheReadError instanceof Error ? cacheReadError.message : String(cacheReadError),
      });
    }

    if (!loadedFromCache) {
      if (normalizedJobType === "notes") {
        markdown = await generateNotesPayload(db, payload);
      } else {
        markdown = await generateSolvedPaperPayload(db, payload);
      }
      try {
        const cacheFile = await storage.createFile(
          cacheBucketId,
          ID.unique(),
          InputFile.fromBuffer(Buffer.from(markdown, "utf8"), cacheFileName),
        );
        cacheFileId = String(cacheFile.$id);
      } catch (cacheWriteError) {
        const contextMessage = "[pdf-generator] Markdown cache write failed. Without the markdown cache the generation result will be lost.";
        console.error(contextMessage, {
          jobId,
          jobType: normalizedJobType,
          cacheBucketId,
          cacheKey,
          message: cacheWriteError instanceof Error ? cacheWriteError.message : String(cacheWriteError),
        });
        const wrappedError = new Error(
          `${contextMessage}: ${cacheWriteError instanceof Error ? cacheWriteError.message : String(cacheWriteError)}`,
        );
        wrappedError.cause = cacheWriteError;
        throw wrappedError;
      }
    }
    await updateJob(db, jobId, { progress_percent: 80 });

    const pdfTitle = buildJobTitle(payload);
    const pdfBuffer = await renderMarkdownToPdfBuffer(markdown, pdfTitle);
    const safePdfCoreName = normalizeSafePdfCoreName(pdfTitle);
    const safePdfFileName = `${safePdfCoreName}.pdf`;
    const pdfFile = await storage.createFile(
      PAPERS_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, safePdfFileName),
    );
    const pdfFileId = String(pdfFile?.$id || "").trim();
    if (!pdfFileId) {
      throw new Error("PDF upload completed without returning a valid file ID.");
    }

    await updateJob(db, jobId, {
      status: "completed",
      progress_percent: 100,
      // result_file_id now points to a concrete PDF file in PAPERS_BUCKET_ID.
      result_file_id: pdfFileId,
      completed_at: new Date().toISOString(),
    });
    await sleep(COMPLETION_WEBHOOK_DELAY_MS);
    try {
      await notifyCompletionWebhook({
        jobId,
        status: "completed",
        fileId: pdfFileId,
        userId: String(payload.userId || "").trim(),
        userEmail: String(payload.userEmail || "").trim(),
        callbackUrl: String(payload.callbackUrl || "").trim(),
      });
    } catch (webhookError) {
      console.warn(
        `[pdf-generator] completion webhook failed for job ${jobId}: ${formatWorkerErrorMessage(webhookError)}`,
      );
    }

    return { ok: true, jobId, fileId: pdfFileId };
  } catch (error) {
    await updateJob(db, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: formatWorkerErrorMessage(error),
    }).catch((err) => console.error("Failed to update job status to failed:", err));
    try {
      await notifyCompletionWebhook({
        jobId,
        status: "failed",
        fileId: "",
        userId: String(payload.userId || "").trim(),
        userEmail: String(payload.userEmail || "").trim(),
        callbackUrl: String(payload.callbackUrl || "").trim(),
      });
    } catch (webhookError) {
      console.error("[pdf-generator] failed to deliver completion webhook.", {
        jobId,
        error: webhookError?.stack || String(webhookError),
      });
    }
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
module.exports.notifyCompletionWebhook = notifyCompletionWebhook;
module.exports.getNotifyCompletionUrl = getNotifyCompletionUrl;

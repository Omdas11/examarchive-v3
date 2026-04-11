import { adminDatabases, adminStorage, BUCKET_ID, COLLECTION, DATABASE_ID, ID, Query, SYLLABUS_BUCKET_ID } from "@/lib/appwrite";
import { runWebSearch, formatSearchResults } from "@/lib/web-search";

type PdfParseFn = (dataBuffer: Buffer) => Promise<{ text?: string }>;

// Import the implementation entry directly to avoid package debug-mode side effects.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as PdfParseFn;

export interface CoursePrefsPayload {
  dsc?: string;
  dsm1?: string;
  dsm2?: string;
  sec?: string;
  idc?: string;
  aec?: string;
  vac?: string;
}

export interface RagContext {
  contextText: string;
  sources: string[];
}

type SourceType = "paper" | "syllabus";

const EMBEDDING_MODEL = "text-embedding-3-small";

// NOTE: Currently using OpenAI for embeddings only. Consider migrating to:
// - Native Appwrite-compatible embeddings (when available)
// - Voyage AI: https://www.voyageai.com/
// - Cohere: https://cohere.com/
// - Self-hosted: sentence-transformers with Ollama or local inference
// See docs/ENVIRONMENT.md for migration guidance.
const SYLLABUS_FILE_URL_RE = /\/api\/files\/syllabus\/([^/?#]+)/;
const SYLLABUS_RANKING_BOOST = 0.03;
const UNTRUSTED_INJECTION_PATTERNS = [
  /ignore\s+previous/gi,
  /ignore\s+all\s+instructions/gi,
  /system\s+prompt/gi,
  /developer\s+message/gi,
  /you\s+must\s+follow/gi,
];

function cleanText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function chunkText(text: string, chunkSize = 1200, overlap = 200): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const safeOverlap = Math.max(0, Math.min(overlap, chunkSize - 1));
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + chunkSize);
    chunks.push(cleaned.slice(start, end));
    if (end >= cleaned.length) break;
    start = end - safeOverlap;
  }
  return chunks;
}

function sanitizeUntrustedContext(text: string): string {
  let sanitized = text;
  for (const pattern of UNTRUSTED_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized;
}

async function embedText(input: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !input.trim()) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: input.slice(0, 8000),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = payload.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) return null;
    return embedding;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return -1;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (!denom) return -1;
  return dot / denom;
}

function serializeCoursePrefs(prefs?: CoursePrefsPayload): string[] {
  if (!prefs) return [];
  return [prefs.dsc, prefs.dsm1, prefs.dsm2, prefs.sec, prefs.idc, prefs.aec, prefs.vac].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

async function listCandidateDocs(prefs?: CoursePrefsPayload): Promise<Array<Record<string, unknown>>> {
  const db = adminDatabases();
  const subjects = serializeCoursePrefs(prefs).map((s) => s.toLowerCase());
  const [papers, syllabus] = await Promise.all([
    db.listDocuments(DATABASE_ID, COLLECTION.papers, [Query.equal("approved", true), Query.limit(40)]).catch(() => ({ documents: [] })),
    db.listDocuments(DATABASE_ID, COLLECTION.syllabus, [Query.equal("approval_status", "approved"), Query.limit(20)]).catch(() => ({ documents: [] })),
  ]);
  // Prioritize syllabus docs first, then papers, so generated notes follow archive syllabus guidance.
  const merged = [...syllabus.documents, ...papers.documents];
  if (subjects.length === 0) return merged;
  return merged.filter((doc) => {
    const subject = String((doc.department ?? doc.subject ?? "")).toLowerCase();
    return subjects.some((s) => subject.includes(s));
  });
}

function resolveFileInfo(doc: Record<string, unknown>): { fileId: string; sourceType: SourceType; sourceLabel: string } | null {
  const paperFileId = typeof doc.file_id === "string" ? doc.file_id.trim() : "";
  if (paperFileId) {
    const label = `${String(doc.course_code ?? "paper")} ${String(doc.year ?? "")}`.trim();
    return { fileId: paperFileId, sourceType: "paper", sourceLabel: label };
  }
  const syllabusUrl = typeof doc.file_url === "string" ? doc.file_url : "";
  const syllabusIdMatch = syllabusUrl.match(SYLLABUS_FILE_URL_RE);
  if (syllabusIdMatch?.[1]) {
    const label = `${String(doc.subject ?? "syllabus")} ${String(doc.university ?? "")}`.trim();
    return { fileId: syllabusIdMatch[1], sourceType: "syllabus", sourceLabel: label };
  }
  return null;
}

async function extractPdfText(bucketId: string, fileId: string): Promise<string> {
  const fileBuffer = await adminStorage().getFileDownload(bucketId, fileId);
  const data = await pdfParse(Buffer.from(fileBuffer));
  return cleanText(data.text ?? "");
}

export async function ingestPdfToRag(args: {
  fileId: string;
  sourceType: SourceType;
  sourceLabel: string;
  courseCode?: string;
  department?: string;
  year?: number | null;
  uploadedBy?: string;
}): Promise<{ chunksStored: number }> {
  const text = await extractPdfText(args.sourceType === "syllabus" ? SYLLABUS_BUCKET_ID : BUCKET_ID, args.fileId);
  if (!text) return { chunksStored: 0 };
  const chunks = chunkText(text);
  const db = adminDatabases();
  let stored = 0;
  const sharedMeta = {
    file_id: args.fileId,
    source_type: args.sourceType,
    source_label: args.sourceLabel.slice(0, 200),
    course_code: (args.courseCode ?? "").slice(0, 80),
    department: (args.department ?? "").slice(0, 120),
    year: typeof args.year === "number" ? args.year : null,
    uploaded_by: (args.uploadedBy ?? "").slice(0, 80),
    embedding_model: EMBEDDING_MODEL,
  };
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const embedding = await embedText(chunk);
    if (!embedding) continue;
    await db.createDocument(DATABASE_ID, COLLECTION.ai_embeddings, ID.unique(), {
      ...sharedMeta,
      chunk_index: index,
      text_chunk: chunk,
      embedding,
    }).catch(() => null);
    stored += 1;
  }
  return { chunksStored: stored };
}

async function getEmbeddingDocsBySubjects(prefs?: CoursePrefsPayload): Promise<Array<Record<string, unknown>>> {
  const db = adminDatabases();
  const preferred = serializeCoursePrefs(prefs);
  const all = await db
    .listDocuments(DATABASE_ID, COLLECTION.ai_embeddings, [Query.limit(120)])
    .catch(() => ({ documents: [] as Array<Record<string, unknown>> }));
  if (preferred.length === 0) return all.documents;
  const normalized = preferred.map((value) => value.toLowerCase());
  const preferredDocs = all.documents.filter((doc) => {
    const dep = String(doc.department ?? "").toLowerCase();
    return normalized.some((value) => dep.includes(value));
  });
  return preferredDocs.length > 0 ? preferredDocs : all.documents;
}

export async function ensureRagCoverage(prefs?: CoursePrefsPayload): Promise<void> {
  const existing = await getEmbeddingDocsBySubjects(prefs);
  if (existing.length >= 12) return;
  const candidates = await listCandidateDocs(prefs);
  for (const doc of candidates.slice(0, 8)) {
    const fileInfo = resolveFileInfo(doc);
    if (!fileInfo) continue;
    const already = existing.some((entry) => entry.file_id === fileInfo.fileId);
    if (already) continue;
    await ingestPdfToRag({
      fileId: fileInfo.fileId,
      sourceType: fileInfo.sourceType,
      sourceLabel: fileInfo.sourceLabel,
      courseCode: typeof doc.course_code === "string" ? doc.course_code : undefined,
      department: typeof doc.department === "string" ? doc.department : typeof doc.subject === "string" ? doc.subject : undefined,
      year: typeof doc.year === "number" ? doc.year : null,
      uploadedBy: typeof doc.uploaded_by === "string" ? doc.uploaded_by : typeof doc.uploader_id === "string" ? doc.uploader_id : undefined,
    }).catch(() => null);
  }
}

export async function buildRagContext(args: {
  query: string;
  coursePrefs?: CoursePrefsPayload;
  includeWebSearch?: boolean;
  referenceFileId?: string;
  referenceLabel?: string;
}): Promise<RagContext> {
  const queryEmbedding = await embedText(args.query);
  const docs = await getEmbeddingDocsBySubjects(args.coursePrefs);

  const safeLabel =
    typeof args.referenceLabel === "string"
      ? sanitizeUntrustedContext(
          args.referenceLabel.replace(/[\r\n\t\f\v]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
        )
      : undefined;

  let referenceSection = "";
  if (args.referenceFileId) {
    try {
      // Prefer already ingested chunks for the reference file to avoid re-downloading large PDFs.
      const matchingDocs = docs.filter(
        (doc) => String((doc as Record<string, unknown>).file_id ?? "") === args.referenceFileId,
      );

      let referenceChunksText = "";

      if (matchingDocs.length > 0) {
        const sortedMatchingDocs = matchingDocs.slice().sort((a, b) => {
          const aIdx = typeof (a as Record<string, unknown>).chunk_index === "number" ? ((a as Record<string, unknown>).chunk_index as number) : 0;
          const bIdx = typeof (b as Record<string, unknown>).chunk_index === "number" ? ((b as Record<string, unknown>).chunk_index as number) : 0;
          return aIdx - bIdx;
        });

        const firstChunks = sortedMatchingDocs
          .map((doc) => {
            const textChunk = (doc as Record<string, unknown>).text_chunk;
            return typeof textChunk === "string" ? textChunk : "";
          })
          .filter((chunk) => chunk)
          .slice(0, 2);

        referenceChunksText = firstChunks.join("\n\n");
      }

      if (!referenceChunksText) {
        const referenceText = await extractPdfText(BUCKET_ID, args.referenceFileId);
        referenceChunksText = chunkText(referenceText, 1200, 150).slice(0, 2).join("\n\n");
      }

      if (referenceChunksText) {
        const label = safeLabel || "Selected PDF";
        referenceSection = `Selected PDF (${label}):\n${sanitizeUntrustedContext(referenceChunksText.slice(0, 2000))}`;
      }
    } catch (e) {
      console.warn("[RAG] Failed to include reference PDF:", e);
    }
  }

  const ranked = docs
    .map((doc) => {
      const embedding = Array.isArray(doc.embedding) ? (doc.embedding as number[]) : [];
      const textChunk = typeof doc.text_chunk === "string" ? doc.text_chunk : "";
      const sourceType = String(doc.source_type ?? "");
      const syllabusBoost = sourceType === "syllabus" ? SYLLABUS_RANKING_BOOST : 0;
      if (!textChunk || !queryEmbedding || embedding.length === 0) {
        return { score: syllabusBoost, doc, textChunk };
      }
      return { score: cosineSimilarity(queryEmbedding, embedding) + syllabusBoost, doc, textChunk };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const ragSection = ranked
    .filter((entry) => entry.textChunk)
    .map((entry, index) => {
      const source = String(entry.doc.source_label ?? entry.doc.course_code ?? entry.doc.file_id ?? "archive");
      return `Archive chunk ${index + 1} (${source}):\n${sanitizeUntrustedContext(entry.textChunk.slice(0, 700))}`;
    })
    .join("\n\n");

  const webResults = args.includeWebSearch ? await runWebSearch(args.query, 5) : [];
  const webSection = webResults.length ? `Web updates:\n${formatSearchResults(webResults)}` : "";

  const contextText = [referenceSection, ragSection, webSection].filter(Boolean).join("\n\n");
  const sources = [
    ...(referenceSection ? [safeLabel || "Selected PDF"] : []),
    ...ranked
      .map((entry) => String(entry.doc.source_label ?? entry.doc.file_id ?? "archive"))
      .filter(Boolean),
    ...webResults.map((result) => result.url),
  ];

  return {
    contextText,
    sources: Array.from(new Set(sources)).slice(0, 8),
  };
}

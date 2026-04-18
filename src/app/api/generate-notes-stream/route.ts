import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { Compression } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  adminDatabases,
  adminStorage,
  BUCKET_ID,
  COLLECTION,
  DATABASE_ID,
  getAppwriteFileDownloadUrl,
  ID,
  MARKDOWN_CACHE_BUCKET_ID,
  Query,
} from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { runGeminiCompletion } from "@/lib/gemini";
import { readDynamicSystemPrompt } from "@/lib/system-prompt";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";
import { SmtpConfigurationError, sendGenerationPdfEmail } from "@/lib/generation-notifications";
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
const CACHE_NUMERIC_STRING_MAX_LEN = 10;
const CACHE_FILE_NAME_MAX_LEN = 220;
const GENERATED_MARKDOWN_MAX_LEN = 1_000_000;
const SYLLABUS_CONTENT_MAX_LEN = 10_000;
const DEFAULT_PERSONALIZATION_TAGS = ["watermark:email_footer", "personalization:enabled"];
const MAX_PERSONALIZATION_TAGS = 20;
const PERSONALIZATION_TAG_MAX_LEN = 64;

function isAdminPlus(role: string): boolean {
  return role === "moderator" || role === "admin" || role === "founder";
}

function resolveGotenbergUrl(): string {
  return (process.env.GOTENBERG_URL || "").trim();
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

function normalizeTopicHeading(topic: string): string {
  return topic
    .replace(/^#+\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getUnitNotesCacheKey(university: string, course: string, stream: string, selectionType: string, paperCode: string): string {
  return `${university}::${course}::${stream}::${selectionType}::${paperCode}`.slice(0, 128);
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul((hash ^ value.charCodeAt(i)) >>> 0, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function sanitizeCacheFileToken(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || `cache_${stableStringHash(value)}`;
}

function buildUnitNotesCacheFileNames(
  university: string,
  course: string,
  stream: string,
  selectionType: string,
  paperCode: string,
  unitNumber: number,
  semester: number | null,
): string[] {
  const legacyName = `${paperCode}_Unit_${unitNumber}_Cache.md`;
  const scope = sanitizeCacheFileToken(getUnitNotesCacheKey(university, course, stream, selectionType, paperCode));
  const semesterToken = semester !== null ? `sem${semester}` : "semall";
  const extension = ".md";
  const scopedBase = `${scope}_${semesterToken}_unit${unitNumber}_cache`;
  const scopedName =
    `${scopedBase.slice(0, Math.max(1, CACHE_FILE_NAME_MAX_LEN - extension.length))}${extension}`;
  return scopedName === legacyName ? [legacyName] : [scopedName, legacyName];
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
  id: string | null;
  markdownFileId: string;
  markdown: string;
  syllabusContent: string | null;
  pdfFileId: string | null;
  createdAt: string | null;
};

function normalizeSemester(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return null;
  return parsed;
}

function extractUnitName(syllabusDoc: Record<string, unknown> | undefined): string {
  if (!syllabusDoc) return "";
  const unitNameRaw = typeof syllabusDoc.unit_name === "string"
    ? syllabusDoc.unit_name
    : (typeof syllabusDoc.unit_title === "string" ? syllabusDoc.unit_title : "");
  return unitNameRaw.trim();
}

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
      COLLECTION.generated_notes_cach[... ELLIPSIZATION ...]          const fallbackMarkdown = [
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

        // IMPORTANT: Persist the markdown cache FIRST and keep the returned
        // cache document ID. We need the SAME document ID a few lines later to
        // persist pdf_file_id after Gotenberg uploads the PDF.
        //
        // If this function returns void or we discard the returned ID, the first
        // generation path loses the association between the cache record and the
        // rendered PDF file. That stale cache shape is what makes the first click
        // appear to only "start" the job and the second click appear to send the
        // email. The second click works only because it re-enters through the
        // cache path after the previous request already uploaded a PDF.
        const cacheDocId = await writeCachedNotes(university, course, streamName, type, paperCode, unitNumber, semester, masterMarkdown, syllabusContent, (message) =>
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
            gotenbergUrl,
            modelName: GEMINI_MODEL,
            generatedAtIso: new Date().toISOString(),
            paperCode,
            paperName,
            unitNumber,
            unitName,
            syllabusContent,
            userEmail: userEmail || undefined,
          });
          pdfUrl = rendered.fileUrl;
          controller.enqueue(toSseData({ log: "PDF rendered and uploaded successfully." }));

          // IMPORTANT: Persist pdf_file_id to the SAME cache document BEFORE we
          // move on to email sending / stream completion.
          //
          // Why this ordering matters:
          // 1. Gotenberg upload succeeds.
          // 2. We immediately write rendered.fileId into generated_notes_cache.
          // 3. Only then do we proceed to email and done events.
          //
          // This keeps the cache, download URL, and later cache-hit behavior in
          // sync. Skipping this write makes the cache look incomplete, so the
          // next click falls back to rerender behavior and users think only the
          // second click actually sends the email.
          if (cacheDocId) {
            try {
              await updateCachedNotesPdfFileId(cacheDocId, rendered.fileId);
              controller.enqueue(toSseData({ log: "PDF file ID persisted to cache record." }));
            } catch (persistError) {
              // Non-fatal: the user already has a valid uploaded PDF and can
              // still receive the email in this request. We only log because the
              // cache-hit path may need to rerender next time if this write fails.
              console.warn("[generate-notes-stream] Could not persist pdf_file_id to cache doc:", persistError);
            }
          } else {
            // writeCachedNotes may return null if markdown caching fails.
            // Do not fail the request just because the cache record is missing;
            // the PDF upload already succeeded and the user should still get the
            // PDF email in the current request.
            console.warn("[generate-notes-stream] cacheDocId unavailable after writeCachedNotes; pdf_file_id not persisted.");
          }
        } catch (pdfError) {
          console.error("[generate-notes-stream] PDF Engine Error:", pdfError);
          const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          controller.enqueue(toSseData({ event: "error", error: `PDF generation failed: ${pipelineMessage}` }));
          closeStream();
          return;
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
            if (isSmtpNotConfiguredError(emailError)) {
              controller.enqueue(toSseData({ log: "Email notification skipped: SMTP is not configured." }));
            } else {
              console.error("[generate-notes-stream] Failed to send generation email:", emailError);
            }
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

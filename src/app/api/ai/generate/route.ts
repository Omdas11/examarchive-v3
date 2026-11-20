/**
 * POST /api/ai/generate — AI Notes (Cloudflare-native, 2026-11-20).
 *
 * Synchronous: generate notes markdown via the provider chain, render a
 * PDF via the HF Gotenberg Space, and stream the PDF back.
 *
 * Auth: login required (middleware also 401s guests on /api/ai).
 * Free tier: exactly 1 free PDF per day per registered account (UTC day).
 * Paid: 10 credits per set, deducted ONLY after a PDF is delivered.
 * Rerun: 1 free manual rerun per PAID generation (different provider is
 * picked automatically by the chain); a rerun of a free daily generation
 * costs 10 credits.
 *
 * PDF BLOCKER (2026-11-20): GOTENBERG_URL is not set on the Worker (it
 * lives only as a GitHub secret; no value was found anywhere). Until the
 * user sets GOTENBERG_URL + GOTENBERG_AUTH_TOKEN as Worker secrets, POST
 * answers 503 PDF_NOT_CONFIGURED — without charging credits or consuming
 * the daily free PDF.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { GENERATION_COST_CREDITS } from "@/lib/economy";
import {
  getNoteLengthOptions,
  getNoteLengthTargets,
  normalizeNoteLength,
  type NoteLength,
} from "@/lib/note-length";
import {
  AI_NOTES_DAILY_FREE_LIMIT,
  MAX_COMPLETION_TOKENS,
  buildAiNotesPrompt,
  generateAiNotesText,
  getAiNotesEnv,
  getFreeUsedToday,
  getGenerationById,
  getUserCreditBalance,
  hasFreeRerunBeenUsed,
  recordCompletedGeneration,
  recordFailedGeneration,
  todayUtcDate,
  type AiNotesEnv,
} from "@/lib/ai-notes";
import { AiNotesPdfError, buildSafePdfFileName, renderAiNotesPdf } from "@/lib/ai-notes-pdf";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function isAdminPlus(role: string): boolean {
  return role === "moderator" || role === "founder";
}

function slugifyTopic(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "ai-notes";
}

async function lookupPaperName(
  db: D1Database,
  paperCode: string,
): Promise<string | null> {
  try {
    const row = await db
      .prepare(
        "SELECT paper_name FROM papers WHERE course_code = ? AND approved = 1 ORDER BY created_at DESC LIMIT 1",
      )
      .bind(paperCode)
      .first<{ paper_name: string | null }>();
    return row?.paper_name ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let body: {
    topic?: string;
    paperCode?: string;
    noteLength?: NoteLength;
    rerunOf?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const noteLength = normalizeNoteLength(body.noteLength);
  const noteTargets = getNoteLengthTargets(noteLength);
  const db = await getD1();
  const todayStr = todayUtcDate();
  const adminPlus = isAdminPlus(user.role);

  // ── Resolve what is being generated (new topic vs rerun) ───────────────
  let topic: string;
  let paperCode: string | null = null;
  let isRerun = false;
  let rerunOfId: string | null = null;
  let originalPaid = false;

  if (typeof body.rerunOf === "string" && body.rerunOf.trim()) {
    const original = await getGenerationById(db, body.rerunOf.trim());
    if (!original || original.user_id !== user.id || original.status !== "completed") {
      return NextResponse.json(
        { error: "Original generation not found." },
        { status: 404 },
      );
    }
    topic = original.topic;
    paperCode = original.paper_code;
    isRerun = true;
    rerunOfId = original.id;
    originalPaid = original.credits_charged > 0;
  } else {
    topic = (body.topic ?? "").trim();
    if (!topic || topic.length > 500) {
      return NextResponse.json(
        { error: "Topic must be 1–500 characters." },
        { status: 400 },
      );
    }
    const rawCode = (body.paperCode ?? "").trim().toUpperCase().slice(0, 40);
    paperCode = rawCode || null;
  }

  // ── Pricing: free daily / paid / free rerun ────────────────────────────
  let creditsCharged = 0;
  let isFreeDaily = false;
  if (!adminPlus) {
    if (isRerun) {
      const freeRerunUsed = originalPaid
        ? await hasFreeRerunBeenUsed(db, rerunOfId as string)
        : false;
      // 1 free rerun per PAID generation; rerun of a free generation costs 10.
      creditsCharged = originalPaid && !freeRerunUsed ? 0 : GENERATION_COST_CREDITS;
    } else {
      const freeUsed = await getFreeUsedToday(db, user.id, todayStr);
      if (!freeUsed) {
        creditsCharged = 0;
        isFreeDaily = true;
      } else {
        creditsCharged = GENERATION_COST_CREDITS;
      }
    }
    if (creditsCharged > 0) {
      const balance = await getUserCreditBalance(db, user.id);
      if (balance < creditsCharged) {
        return NextResponse.json(
          {
            error: `Not enough credits. This PDF costs ${creditsCharged} credits and you have ${balance}.`,
            code: "INSUFFICIENT_CREDITS",
            credits: balance,
            cost: creditsCharged,
          },
          { status: 402 },
        );
      }
    }
  }

  // ── Provider keys present? ─────────────────────────────────────────────
  let env: AiNotesEnv;
  try {
    env = await getAiNotesEnv();
  } catch {
    return NextResponse.json(
      { error: "AI generation is temporarily unavailable. Please try again shortly." },
      { status: 503 },
    );
  }
  const anyProviderConfigured =
    Boolean(env.geminiApiKey) ||
    env.groqKeys.length > 0 ||
    env.openrouterKeys.length > 0 ||
    env.githubKeys.length > 0;
  if (!anyProviderConfigured) {
    return NextResponse.json(
      { error: "AI generation is not configured." },
      { status: 503 },
    );
  }

  const generationId = crypto.randomUUID();
  const recordBase = {
    id: generationId,
    userId: user.id,
    date: todayStr,
    topic,
    paperCode,
    noteLength,
    isRerun,
    rerunOf: rerunOfId,
  };

  // ── Generate the notes markdown ────────────────────────────────────────
  let paperName: string | null = null;
  if (paperCode) paperName = await lookupPaperName(db, paperCode);
  const prompt = buildAiNotesPrompt({
    topic,
    paperCode: paperCode ?? undefined,
    paperName: paperName ?? undefined,
    noteLength,
  });

  let generated: { content: string; provider: string; model: string };
  try {
    generated = await generateAiNotesText(env, {
      prompt,
      maxTokens: Math.min(MAX_COMPLETION_TOKENS, noteTargets.maxTokens),
      temperature: 0.6,
    });
  } catch (err) {
    await recordFailedGeneration(db, { ...recordBase, provider: null, model: null });
    console.error("[AI Notes] All providers exhausted:", err);
    return NextResponse.json(
      {
        error:
          "All AI providers are busy right now. Please try again in a few minutes — nothing was charged.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  // ── Render the PDF ─────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderAiNotesPdf({
      markdown: generated.content,
      gotenbergUrl: env.gotenbergUrl,
      gotenbergAuthToken: env.gotenbergAuthToken,
      modelName: generated.model,
      generatedAtIso: new Date().toISOString(),
      paperCode: paperCode ?? undefined,
      paperName: paperName ?? undefined,
      topic,
      userEmail: user.email,
    });
  } catch (err) {
    await recordFailedGeneration(db, {
      ...recordBase,
      provider: generated.provider,
      model: generated.model,
    });
    if (err instanceof AiNotesPdfError && err.code === "PDF_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error:
            "PDF rendering is not set up yet — the notes were generated but the PDF service is missing. Nothing was charged and your free PDF for today is still available.",
          code: "PDF_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }
    console.error("[AI Notes] PDF render failed:", err);
    return NextResponse.json(
      {
        error:
          "The notes were generated but the PDF could not be rendered. Please try again — nothing was charged.",
        code: "PDF_RENDER_FAILED",
      },
      { status: 503 },
    );
  }

  // ── Record + deduct ONLY now that the PDF exists ───────────────────────
  const recorded = await recordCompletedGeneration(db, {
    ...recordBase,
    provider: generated.provider,
    model: generated.model,
    creditsCharged,
    status: "completed",
    isFreeDaily,
  });
  if (!recorded) {
    // Balance moved under us between the check and the deduction.
    return NextResponse.json(
      {
        error:
          "Not enough credits. The PDF was generated but could not be delivered.",
        code: "INSUFFICIENT_CREDITS",
      },
      { status: 402 },
    );
  }

  const fileName = buildSafePdfFileName({
    fileBaseName: `ai-notes-${slugifyTopic(topic)}`,
  });
  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-AI-Notes-Generation-Id": generationId,
      "X-AI-Notes-Provider": generated.provider,
      "X-AI-Notes-Model": generated.model,
      "X-AI-Notes-Credits-Charged": String(creditsCharged),
      "X-AI-Notes-Free-Daily": isFreeDaily ? "1" : "0",
      "Cache-Control": "no-store",
    },
  });
}

/** GET: today's AI Notes status for the current user. */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const db = await getD1();
  const todayStr = todayUtcDate();
  const adminPlus = isAdminPlus(user.role);
  const [freeUsed, credits] = await Promise.all([
    adminPlus
      ? Promise.resolve(false)
      : getFreeUsedToday(db, user.id, todayStr),
    getUserCreditBalance(db, user.id),
  ]);

  let configured = false;
  try {
    const env = await getAiNotesEnv();
    configured =
      Boolean(env.geminiApiKey) ||
      env.groqKeys.length > 0 ||
      env.openrouterKeys.length > 0 ||
      env.githubKeys.length > 0;
  } catch {
    configured = false;
  }

  return NextResponse.json({
    freeUsedToday: freeUsed,
    freeRemainingToday: adminPlus
      ? null
      : Math.max(0, AI_NOTES_DAILY_FREE_LIMIT - (freeUsed ? 1 : 0)),
    credits,
    costPerSet: GENERATION_COST_CREDITS,
    isAdminPlus: adminPlus,
    configured,
    noteLengthOptions: getNoteLengthOptions(),
  });
}

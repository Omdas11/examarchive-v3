"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastContext";
import AiNotConfiguredNotice from "@/components/AiNotConfiguredNotice";
import CustomDropdown, { type CustomDropdownOption } from "@/components/CustomDropdown";
import { GENERATION_COST_CREDITS } from "@/lib/economy";
import CreditIcon from "@/components/CreditIcon";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";
import { IconWarning } from "@/components/Icons";
import type { NoteLength } from "@/lib/note-length";

const GENERATION_REQUEST_TIMEOUT_MS = 300_000;

const FALLBACK_LENGTH_OPTIONS: Array<{
  value: NoteLength;
  label: string;
  description: string;
}> = [
  { value: "concise", label: "Concise", description: "Quick skim, high-yield pointers" },
  { value: "standard", label: "Standard", description: "Balanced depth for a chapter" },
  { value: "detailed", label: "Detailed", description: "Extended explanations + examples" },
  { value: "comprehensive", label: "Comprehensive", description: "Deep dive, approx 8-10 pages" },
  { value: "exhaustive", label: "Exhaustive", description: "Maximum depth, approx 12-15 pages" },
];

interface AiNotesStatus {
  freeUsedToday: boolean;
  freeRemainingToday: number | null;
  credits: number;
  costPerSet: number;
  isAdminPlus: boolean;
  configured: boolean;
  noteLengthOptions?: Array<{ value: NoteLength; label: string; description: string }>;
}

function LoadingDots() {
  return (
    <span className="inline-flex items-end gap-1" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

export default function AIContentClient() {
  const { showToast } = useToast();
  const [topic, setTopic] = useState("");
  const [paperCode, setPaperCode] = useState("");
  const [noteLength, setNoteLength] = useState<NoteLength>("standard");
  const [status, setStatus] = useState<AiNotesStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{
    tone: "info" | "success" | "error";
    message: string;
  } | null>(null);
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  const lengthOptions = status?.noteLengthOptions?.length
    ? status.noteLengthOptions
    : FALLBACK_LENGTH_OPTIONS;
  const lengthDropdownOptions: CustomDropdownOption[] = lengthOptions.map(
    (option) => ({ label: option.label, value: option.value }),
  );
  const selectedLength =
    lengthOptions.find((option) => option.value === noteLength) ??
    FALLBACK_LENGTH_OPTIONS[1];
  const credits = status?.credits ?? null;
  const costPerSet = status?.costPerSet ?? GENERATION_COST_CREDITS;
  const freeRemainingToday = status?.freeRemainingToday ?? null;
  const freeAvailable =
    status?.isAdminPlus === true || freeRemainingToday === null
      ? null
      : freeRemainingToday > 0;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/generate")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AiNotesStatus;
      })
      .then((data) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {
        // Status is decoration — generation still attempts and reports errors.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refreshStatus() {
    fetch("/api/ai/generate")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as AiNotesStatus;
      })
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {});
  }

  async function runGeneration(body: Record<string, unknown>) {
    if (generating) return;
    setError(null);
    setGenerating(true);
    setGenerationStatus({
      tone: "info",
      message: "Generating your notes. This can take a minute — please wait…",
    });
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), GENERATION_REQUEST_TIMEOUT_MS);
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        let failureMessage = "Failed to generate notes.";
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error) {
            failureMessage = data.error;
          }
        } catch {
          // Keep the default message.
        }
        setError(failureMessage);
        setGenerationStatus({ tone: "error", message: failureMessage });
        return;
      }
      const blob = await response.blob();
      const generationId = response.headers.get("X-AI-Notes-Generation-Id");
      const provider = response.headers.get("X-AI-Notes-Provider");
      const charged = response.headers.get("X-AI-Notes-Credits-Charged");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = /filename="([^"]+)"/.exec(disposition);
      const fileName = fileNameMatch?.[1] ?? "ai-notes.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      if (generationId) setLastGenerationId(generationId);
      if (provider) setLastProvider(provider);
      dispatchProfileRefreshEvent();
      refreshStatus();
      const successMessage =
        charged && charged !== "0"
          ? `Your AI Notes PDF downloaded (${charged} credits used).`
          : "Your AI Notes PDF downloaded — today's free PDF.";
      setGenerationStatus({ tone: "success", message: successMessage });
      showToast(successMessage, "success");
    } catch (err) {
      const failureMessage =
        err instanceof DOMException && err.name === "AbortError"
          ? "Request timed out while generating. Please try again."
          : err instanceof Error
            ? err.message
            : "Network error. Please try again.";
      setError(failureMessage);
      setGenerationStatus({ tone: "error", message: failureMessage });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setGenerating(false);
    }
  }

  async function generate() {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError("Enter a topic first.");
      return;
    }
    await runGeneration({
      topic: trimmedTopic,
      paperCode: paperCode.trim() || undefined,
      noteLength,
    });
  }

  async function rerun() {
    if (!lastGenerationId) return;
    await runGeneration({ rerunOf: lastGenerationId });
  }

  const canGenerate = !generating && topic.trim().length > 0;

  return (
    <div className="relative min-h-screen bg-surface px-4 py-8 text-on-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-outline-variant/30 bg-surface-container p-6 shadow-lift">
          <h1 className="flex flex-wrap items-center gap-2 text-3xl font-bold">
            AI Notes
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Experimental
            </span>
          </h1>
          <p className="mt-2 text-on-surface-variant">
            Generate exam-ready study notes as a PDF. 1 free PDF per day, then{" "}
            <span className="inline-flex items-center gap-1 font-semibold">
              <CreditIcon size={13} />
              {costPerSet}
            </span>{" "}
            per set.
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            AI Notes is experimental — generations may fail or change while we
            improve it.
          </p>
          <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {freeAvailable === null
              ? "Daily free PDF: available"
              : freeAvailable
                ? "Daily free PDF: available"
                : "Daily free PDF: used — next PDF costs credits"}
            {typeof credits === "number" ? ` · ${credits} credits` : ""}
          </div>
        </header>
        <AiNotConfiguredNotice />

        <section className="card border border-outline-variant/30 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold" htmlFor="ai-notes-topic">
                Topic
              </label>
              <input
                id="ai-notes-topic"
                className="input-field w-full"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. Partial Differential Equations, or Photosynthesis"
                disabled={generating}
                maxLength={500}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="ai-notes-paper-code">
                Paper code (optional)
              </label>
              <input
                id="ai-notes-paper-code"
                className="input-field w-full"
                value={paperCode}
                onChange={(event) => setPaperCode(event.target.value)}
                placeholder="e.g. MTMDSC301T"
                disabled={generating}
                maxLength={40}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Note length</label>
              <CustomDropdown
                options={lengthDropdownOptions}
                value={noteLength}
                onChange={(nextValue) => setNoteLength(nextValue as NoteLength)}
                disabled={generating}
              />
              <p className="mt-2 text-xs text-on-surface/70">
                {selectedLength.description}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <button
              onClick={() => void generate()}
              disabled={!canGenerate}
              aria-busy={generating}
              aria-live="polite"
              className="btn-primary relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:content-[''] hover:before:animate-[shimmer_1.4s_ease-in-out_infinite] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              {generating ? (
                <>
                  Generating…
                  <LoadingDots />
                </>
              ) : (
                "Generate AI Notes PDF"
              )}
            </button>
            {lastGenerationId ? (
              <button
                onClick={() => void rerun()}
                disabled={generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/40 px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                Rerun with a different provider
                {lastProvider ? ` (last: ${lastProvider})` : ""}
              </button>
            ) : null}
            <p className="text-xs text-on-surface-variant">
              A rerun of a paid PDF is free once; a rerun of today&apos;s free
              PDF costs {costPerSet} credits.
            </p>
          </div>
          {generationStatus ? (
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`mt-3 text-sm ${
                generationStatus.tone === "success"
                  ? "text-green-700"
                  : generationStatus.tone === "error"
                    ? "text-error"
                    : "text-on-surface-variant"
              }`}
            >
              {generationStatus.message}
            </p>
          ) : null}
          {error && generationStatus?.tone !== "error" ? (
            <p className="mt-3 inline-flex items-center gap-1 text-sm text-error">
              <IconWarning size={14} /> {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

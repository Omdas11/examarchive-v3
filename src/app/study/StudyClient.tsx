"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastContext";

interface Flashcard {
  question: string;
  answer: string;
  hint?: string;
}

function LoadingDots() {
  return (
    <span className="inline-flex items-end gap-1 align-middle" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

const SUBJECT_OPTIONS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Computer Science",
  "Biology",
  "Economics",
  "History",
];

export default function StudyClient() {
  const { showToast } = useToast();
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [topic, setTopic] = useState<string>("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitUsed, setLimitUsed] = useState(0);
  const [limit, setLimit] = useState(5);

  const remaining = useMemo(() => Math.max(limit - limitUsed, 0), [limit, limitUsed]);

  useEffect(() => {
    fetch("/api/study/flashcards")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.used === "number") setLimitUsed(data.used);
        if (typeof data.limit === "number") setLimit(data.limit);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim() && !subject.trim()) {
      showToast("Please select a subject or topic.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/study/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.used === "number") setLimitUsed(data.used);
        if (typeof data.limit === "number") setLimit(data.limit);
        showToast(data.error || "Unable to generate flashcards right now.", "error");
        return;
      }

      setFlashcards(data.flashcards ?? []);
      setLimitUsed(data.used ?? limitUsed);
      setLimit(data.limit ?? limit);
      showToast("Flashcards generated successfully!", "success");
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-outline/10 bg-surface shadow-ambient">
        <div className="flex items-center justify-between border-b border-outline/10 px-6 py-4">
          <div>
            <p className="text-sm font-medium text-on-surface-variant">Daily Limit</p>
            <p className="text-xl font-semibold text-on-surface">
              Generations: {limitUsed} / {limit}
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            {remaining} remaining
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-[1fr,1fr,auto] md:items-end">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Subject</span>
            <select
              className="w-full rounded-xl border border-outline/20 bg-surface-variant px-4 py-3 text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
            >
              {SUBJECT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-on-surface-variant">Topic / Focus</span>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Quantum Entanglement or Dynamic Programming"
              className="w-full rounded-xl border border-outline/20 bg-surface-variant px-4 py-3 text-on-surface placeholder:text-on-surface-variant/70 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              disabled={loading}
              maxLength={200}
            />
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <LoadingDots />
                Generating…
              </span>
            ) : (
              "Generate AI Flashcards"
            )}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">Flashcards</h2>
          {loading && (
            <div className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant">
              <LoadingDots />
              <span>AI is preparing your cards…</span>
            </div>
          )}
        </div>

        {flashcards.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-outline/30 bg-surface-variant/40 px-6 py-10 text-center text-on-surface-variant">
            Start by picking a subject and topic, then hit Generate to see AI flashcards here.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {flashcards.map((card, idx) => (
            <div
              key={`${card.question}-${idx}`}
              className="rounded-2xl border border-outline/10 bg-surface p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Card {idx + 1}</span>
                {card.hint && <span className="text-xs text-on-surface-variant">Hint available</span>}
              </div>
              <h3 className="text-base font-semibold text-on-surface mb-2">{card.question}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{card.answer}</p>
              {card.hint && (
                <p className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                  Hint: {card.hint}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

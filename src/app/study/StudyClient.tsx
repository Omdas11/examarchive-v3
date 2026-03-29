"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastContext";
import { FLASHCARD_COUNT_OPTIONS, FLASHCARD_FIELD_MAX_LEN } from "@/lib/flashcards-constants";
import { IconCheck, IconSparkles, IconXMark } from "@/components/Icons";

interface Flashcard {
  question: string;
  answer: string;
  hint?: string;
}

type CardStatus = "pending" | "checked" | "unchecked";
const SWIPE_THRESHOLD_PX = 40;

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
  const [cardStatus, setCardStatus] = useState<CardStatus[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [activeSwipe, setActiveSwipe] = useState<{ index: number; startX: number; lastX: number } | null>(null);
  const [count, setCount] = useState<number>(FLASHCARD_COUNT_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [limitUsed, setLimitUsed] = useState(0);
  const [limit, setLimit] = useState(5);

  const remaining = useMemo(() => Math.max(limit - limitUsed, 0), [limit, limitUsed]);
  const checkedCount = useMemo(() => cardStatus.filter((s) => s === "checked").length, [cardStatus]);
  const uncheckedCount = useMemo(() => cardStatus.filter((s) => s === "unchecked").length, [cardStatus]);
  const pendingCount = useMemo(() => cardStatus.filter((s) => s === "pending").length, [cardStatus]);

  useEffect(() => {
    fetch("/api/study/flashcards")
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.used === "number") setLimitUsed(data.used);
        else setLimitUsed(0);
        if (typeof data.limit === "number") setLimit(data.limit);
      })
      .catch((error) => {
        console.error("[study] Failed to load flashcard limits", error);
      });
  }, []);

  const toggleFlip = (index: number) => {
    setFlipped((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const markCard = (index: number, status: CardStatus) => {
    setCardStatus((prev) => prev.map((v, i) => (i === index ? status : v)));
  };

  const handlePointerStart = (index: number, clientX: number) => {
    setActiveSwipe({ index, startX: clientX, lastX: clientX });
  };

  const handlePointerMove = (index: number, clientX: number) => {
    setActiveSwipe((prev) => {
      if (!prev || prev.index !== index) return prev;
      return { ...prev, lastX: clientX };
    });
  };

  const handlePointerEnd = (index: number, clientX?: number) => {
    if (!activeSwipe || activeSwipe.index !== index) return;
    const deltaX = (clientX ?? activeSwipe.lastX) - activeSwipe.startX;
    if (deltaX > SWIPE_THRESHOLD_PX) {
      markCard(index, "checked");
    } else if (deltaX < -SWIPE_THRESHOLD_PX) {
      markCard(index, "unchecked");
    }
    setActiveSwipe(null);
  };

  const resetCardState = (cards: Flashcard[]) => {
    setCardStatus(cards.map(() => "pending"));
    setFlipped(cards.map(() => false));
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      showToast("Please enter a topic to generate flashcards.", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/study/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.used === "number") setLimitUsed(data.used);
        if (typeof data.limit === "number") setLimit(data.limit);
        showToast(data.error || "Unable to generate flashcards right now.", "error");
        return;
      }

      const cards: Flashcard[] = data.flashcards ?? [];
      setFlashcards(cards);
      resetCardState(cards);
      setLimitUsed(typeof data.used === "number" ? data.used : 0);
      setLimit(typeof data.limit === "number" ? data.limit : limit);
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
              maxLength={FLASHCARD_FIELD_MAX_LEN}
            />
          </label>

          <div className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-on-surface-variant">Cards per run</span>
            <div className="flex flex-wrap gap-2">
              {FLASHCARD_COUNT_OPTIONS.map((option) => {
                const isActive = option === count;
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setCount(option)}
                    disabled={loading}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-outline/30 bg-surface-variant text-on-surface"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {option} cards
                  </button>
                );
              })}
            </div>
          </div>

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

        {flashcards.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-surface-variant/40 px-3 py-2 text-sm text-on-surface-variant">
            <IconSparkles size={16} className="text-primary" />
            <span>Tap to flip. Swipe right to mark Known, left for Review. Buttons work too.</span>
          </div>
        )}

        <div className="relative min-h-[460px]">
          {flashcards.map((card, idx) => {
            const status = cardStatus[idx] ?? "pending";
            const isFlipped = flipped[idx] ?? false;
            const statusStyles =
              status === "checked"
                ? "bg-green-100 text-green-700 border-green-300"
                : status === "unchecked"
                  ? "bg-error/10 text-error border-error/30"
                  : "bg-primary/5 text-primary border-primary/20";

            const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
              handlePointerStart(idx, e.clientX);
            };
            const handlePointerMoveEvent = (e: React.PointerEvent<HTMLDivElement>) => {
              handlePointerMove(idx, e.clientX);
            };
            const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
              handlePointerEnd(idx, e.clientX);
            };

            const layer = flashcards.length - idx;
            const offset = idx * 12;

            return (
              <div
                key={card.question ? `${card.question}-${idx}` : `card-${idx}`}
                className="group absolute inset-0 mx-auto aspect-[4/5] w-full max-w-xl cursor-pointer overflow-hidden rounded-2xl border border-outline/20 bg-surface shadow-lg transition"
                style={{
                  zIndex: layer,
                  transform: `translateY(${offset}px)`,
                }}
                onClick={() => toggleFlip(idx)}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMoveEvent}
                onPointerUp={handlePointerUp}
              >
                <div
                  className={`absolute inset-0 h-full w-full p-5 transition-transform duration-300 [transform-style:preserve-3d] ${
                    isFlipped ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  <div className="absolute inset-0 flex flex-col gap-3 rounded-3xl bg-surface p-4 [backface-visibility:hidden]">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles}`}
                      >
                        {status === "checked" ? "Known" : status === "unchecked" ? "Review" : "Pending"}
                      </span>
                      <span className="text-xs font-semibold text-primary">Card {idx + 1}</span>
                    </div>
                    <div className="flex-1 rounded-2xl bg-surface-variant/50 p-3 text-on-surface shadow-inner">
                      <h3 className="text-base font-semibold text-on-surface">Q: {card.question}</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant">Tap to flip and see the answer</p>
                  </div>

                  <div className="absolute inset-0 flex flex-col gap-3 rounded-3xl bg-surface p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles}`}
                      >
                        {status === "checked" ? "Known" : status === "unchecked" ? "Review" : "Pending"}
                      </span>
                      <span className="text-xs font-semibold text-primary">Answer</span>
                    </div>
                    <div className="flex-1 rounded-2xl bg-surface-variant/50 p-3 text-on-surface shadow-inner">
                      <p className="text-sm leading-relaxed text-on-surface-variant">{card.answer}</p>
                    </div>
                    {card.hint && (
                      <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                        Hint: {card.hint}
                      </p>
                    )}
                    <p className="text-xs text-on-surface-variant">Tap to flip back</p>
                  </div>
                </div>

                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-surface/90 px-3 py-2 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm font-semibold text-error transition hover:bg-error/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      markCard(idx, "unchecked");
                    }}
                  >
                    <IconXMark size={18} />
                    Review
                  </button>
                  <button
                    type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-green-300 bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      markCard(idx, "checked");
                    }}
                  >
                    <IconCheck size={18} />
                    Known
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {flashcards.length > 0 && (
          <div className="rounded-2xl border border-outline/10 bg-surface-variant/40 px-4 py-3 text-sm text-on-surface">
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-semibold">Session summary</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                Total cards: {flashcards.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-700">
                <IconCheck size={16} />
                Checked: {checkedCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-3 py-1 text-error">
                <IconXMark size={16} />
                Review: {uncheckedCount}
              </span>
              <span className="rounded-full bg-on-surface/5 px-3 py-1 text-on-surface-variant">
                Remaining: {pendingCount}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

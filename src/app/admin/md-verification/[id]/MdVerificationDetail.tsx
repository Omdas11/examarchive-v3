"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  STATUS_LABELS,
  type MdVerificationItem,
} from "@/lib/md-verification";
import {
  parseMd,
  reassembleMd,
  updateHeaderField,
  type ParsedMd,
} from "@/lib/md-verification-parse";
import type {
  MdVerificationLock,
  MdVerificationSuggestion,
} from "@/lib/md-verification-access";
import PdfLineViewer, { type HighlightTarget } from "./PdfLineViewer";

/**
 * Side-by-side verification view, v2. Large screens: PDF on the left,
 * question cards on the right. Phones: stacked, PDF first.
 *
 * - Default view is one card per question: plain text box, marks box,
 *   page box, and a "Looks right / Needs fix" toggle. No markdown
 *   knowledge needed. Saving reassembles the cards back into md in
 *   the same format, so the stored md never changes shape.
 * - The raw markdown editor sits behind "Raw text", founder only.
 * - Hovering (or tapping) a card highlights its line in the PDF.
 * - Only the assigned verifier sees the four action buttons. Everyone
 *   else gets a "Suggest an edit" form. The founder can assign the
 *   item from this page.
 * - A soft lock shows who else is editing; the save carries the
 *   updated_at the page loaded with, so a newer save gets a 409 and a
 *   Reload button instead of silently overwriting.
 */

interface CardEdit {
  key: string;
  label: string;
  unit: string | null;
  text: string;
  marks: string;
  page: string;
  needsFix: boolean;
}

interface ItemResponse {
  item: MdVerificationItem;
  suggestions: MdVerificationSuggestion[];
  lock: MdVerificationLock | null;
  can_act: boolean;
  is_founder: boolean;
}

interface VerifierOption {
  user_id: string;
  name: string | null;
  email: string | null;
}

const inputCls =
  "w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const smallInputCls =
  "w-20 border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 text-sm text-[var(--color-text)]";

function toCardState(parsed: ParsedMd): CardEdit[] {
  return parsed.questions.map((q) => ({
    key: q.key,
    label: q.label,
    unit: q.unit,
    text: q.text,
    marks: q.marks === null ? "" : String(q.marks),
    page: q.page === null ? "" : String(q.page),
    needsFix: false,
  }));
}

export default function MdVerificationDetail({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<MdVerificationItem | null>(null);
  const [suggestions, setSuggestions] = useState<MdVerificationSuggestion[]>(
    [],
  );
  const [lock, setLock] = useState<MdVerificationLock | null>(null);
  const [canAct, setCanAct] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [parsed, setParsed] = useState<ParsedMd | null>(null);
  const [cards, setCards] = useState<CardEdit[]>([]);
  const [headerFull, setHeaderFull] = useState("");
  const [headerPass, setHeaderPass] = useState("");
  const [headerTime, setHeaderTime] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mode, setMode] = useState<"cards" | "preview" | "raw">("cards");
  const [editSource, setEditSource] = useState<"cards" | "raw">("cards");
  const [rawDraft, setRawDraft] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<MdVerificationItem | null>(null);
  const [suggestRef, setSuggestRef] = useState("");
  const [suggestText, setSuggestText] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestSent, setSuggestSent] = useState(false);
  const [verifiers, setVerifiers] = useState<VerifierOption[]>([]);
  const [assignSel, setAssignSel] = useState("");
  const [assigning, setAssigning] = useState(false);

  const initFromItem = useCallback((next: MdVerificationItem) => {
    setItem(next);
    setNote(next.note ?? "");
    setRawDraft(next.md_text);
    const nextParsed = parseMd(next.md_text);
    setParsed(nextParsed);
    setCards(toCardState(nextParsed));
    setHeaderFull(
      nextParsed.header.fullMarks === null
        ? ""
        : String(nextParsed.header.fullMarks),
    );
    setHeaderPass(
      nextParsed.header.passMarks === null
        ? ""
        : String(nextParsed.header.passMarks),
    );
    setHeaderTime(nextParsed.header.time ?? "");
    setConflict(null);
    setAssignSel(next.assigned_to ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/md-verification/${itemId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load the item");
      const data = (await res.json()) as ItemResponse;
      initFromItem(data.item);
      setSuggestions(data.suggestions ?? []);
      setLock(data.lock ?? null);
      setCanAct(data.can_act ?? false);
      setIsFounder(data.is_founder ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the item");
    } finally {
      setLoading(false);
    }
  }, [itemId, initFromItem]);

  useEffect(() => {
    void load();
  }, [load]);

  // Soft lock: the assignee heartbeats every 30 s; everyone else
  // refreshes the lock state on the same beat.
  useEffect(() => {
    if (!item) return;
    const beat = async () => {
      try {
        const res = await fetch(`/api/md-verification/${item.id}/lock`, {
          method: canAct ? "POST" : "GET",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { lock?: MdVerificationLock | null };
        if (data.lock !== undefined) setLock(data.lock);
      } catch {
        // Locks are advisory; a failed heartbeat changes nothing.
      }
    };
    void beat();
    const timer = setInterval(() => void beat(), 30000);
    return () => clearInterval(timer);
  }, [item, canAct]);

  // Founder-only: who can this item be assigned to.
  useEffect(() => {
    if (!isFounder) return;
    (async () => {
      try {
        const res = await fetch("/api/md-verification/verifiers", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { verifiers?: VerifierOption[] };
        setVerifiers(data.verifiers ?? []);
      } catch {
        // Assign panel stays hidden when the list cannot load.
      }
    })();
  }, [isFounder]);

  /** md text built from the current card + header edits. */
  const buildMd = useCallback((): string | null => {
    if (!parsed) return null;
    const next: ParsedMd = JSON.parse(JSON.stringify(parsed)) as ParsedMd;
    for (const card of cards) {
      const q = next.questions.find((item) => item.key === card.key);
      if (!q) continue;
      const marks = card.marks.trim() === "" ? null : Number(card.marks);
      const page = card.page.trim() === "" ? null : Number(card.page);
      q.edited =
        q.text !== card.text ||
        q.marks !== (Number.isFinite(marks) ? marks : null) ||
        q.page !== (Number.isFinite(page) ? page : null);
      q.text = card.text;
      q.marks = Number.isFinite(marks) ? marks : null;
      q.page = Number.isFinite(page) ? page : null;
    }
    if (headerFull.trim() !== "") {
      updateHeaderField(next, "fullMarks", headerFull.trim());
    }
    if (headerPass.trim() !== "") {
      updateHeaderField(next, "passMarks", headerPass.trim());
    }
    if (headerTime.trim() !== "") {
      updateHeaderField(next, "time", headerTime.trim());
    }
    return reassembleMd(next);
  }, [parsed, cards, headerFull, headerPass, headerTime]);

  const dirty =
    item !== null &&
    (editSource === "raw"
      ? rawDraft !== item.md_text
      : buildMd() !== null && buildMd() !== item.md_text);

  async function save(submit: boolean) {
    if (!item) return;
    const mdText = editSource === "raw" ? rawDraft : buildMd();
    if (mdText === null) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(`/api/md-verification/${item.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          md_text: mdText,
          note: note || undefined,
          expected_updated_at: item.updated_at,
        }),
      });
      const data = (await res.json()) as {
        item?: MdVerificationItem;
        error?: string;
      };
      if (res.status === 409 && data.item) {
        setConflict(data.item);
        setError(data.error ?? "Someone saved a newer version.");
        return;
      }
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Save failed");
      }
      initFromItem(data.item);
      setSavedAt(submit ? "Submitted for review." : "Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function review(action: "approve" | "needs_fix") {
    if (!item) return;
    if (action === "approve") {
      const flagged = cards.filter((c) => c.needsFix);
      if (flagged.length > 0) {
        setError(
          `${flagged.map((c) => c.label).join(", ")} ${flagged.length === 1 ? "is" : "are"} still flagged as needing a fix — clear the flag or use Needs fix.`,
        );
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/md-verification/${item.id}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = (await res.json()) as {
        item?: MdVerificationItem;
        xp_awarded?: number;
        credits_awarded?: number;
        error?: string;
      };
      if (res.status === 409 && data.item) {
        setConflict(data.item);
        setError(data.error ?? "This item was already decided.");
        return;
      }
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Review failed");
      }
      initFromItem(data.item);
      setSavedAt(
        action === "approve"
          ? data.xp_awarded && data.xp_awarded > 0
            ? `Approved. +${data.xp_awarded} XP and +${data.credits_awarded ?? 0} AI credits earned. This md is now the source of truth for AI Notes.`
            : "Approved. This md is now the source of truth for AI Notes."
          : "Sent back for fixes.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitSuggestion() {
    if (!item || !suggestText.trim()) return;
    setSaving(true);
    setError(null);
    setSuggestSent(false);
    try {
      const res = await fetch(
        `/api/md-verification/${item.id}/suggestions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_ref: suggestRef || undefined,
            proposed_text: suggestText.trim(),
            note: suggestNote || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        suggestion?: MdVerificationSuggestion;
        error?: string;
      };
      if (!res.ok || !data.suggestion) {
        throw new Error(data.error ?? "Could not send the suggestion");
      }
      setSuggestions((prev) => [...prev, data.suggestion!]);
      setSuggestRef("");
      setSuggestText("");
      setSuggestNote("");
      setSuggestSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the suggestion");
    } finally {
      setSaving(false);
    }
  }

  async function decideSuggestion(
    suggestionId: string,
    action: "apply" | "dismiss",
  ) {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/md-verification/${item.id}/suggestions/${suggestionId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = (await res.json()) as {
        suggestion?: MdVerificationSuggestion;
        item?: MdVerificationItem;
        error?: string;
      };
      if (!res.ok || !data.suggestion) {
        throw new Error(data.error ?? "Could not update the suggestion");
      }
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? data.suggestion! : s)),
      );
      if (data.item) initFromItem(data.item);
      setSavedAt(
        action === "apply"
          ? "Suggestion applied to the text."
          : "Suggestion dismissed.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the suggestion",
      );
    } finally {
      setSaving(false);
    }
  }

  async function assignItem() {
    if (!item) return;
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/md-verification/${item.id}/assign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: assignSel || null }),
      });
      const data = (await res.json()) as {
        item?: MdVerificationItem;
        error?: string;
      };
      if (!res.ok || !data.item) {
        throw new Error(data.error ?? "Could not assign the item");
      }
      setItem(data.item);
      setSavedAt(
        data.item.assigned_to
          ? "Item assigned."
          : "Item unassigned — nobody can act on it until it is assigned.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the item");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Loading…</p>;
  }
  if (error && !item) {
    return (
      <div>
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/admin/md-verification"
          className="mt-4 inline-block text-sm underline"
        >
          Back to the queue
        </Link>
      </div>
    );
  }
  if (!item) return null;

  const activeCard = cards.find((c) => c.key === activeKey) ?? null;
  const highlightTarget: HighlightTarget = activeCard
    ? {
        key: activeCard.key,
        page:
          activeCard.page.trim() === "" || !Number.isFinite(Number(activeCard.page))
            ? null
            : Math.max(1, Math.floor(Number(activeCard.page))),
        text: activeCard.text,
      }
    : { key: null, page: null, text: null };
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const showActions = canAct && item.status !== "approved";
  const showSuggest =
    !canAct && item.status !== "approved";
  const useCards = parsed !== null && parsed.hasQuestions;

  return (
    <div>
      <Link href="/admin/md-verification" className="text-sm underline">
        Back to the queue
      </Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{item.paper_code}</h1>
        <span className="text-sm font-semibold">
          {STATUS_LABELS[item.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">
        {item.type === "question" ? "Question paper" : "Syllabus"}
        {" · "}Batch {item.batch_id}
        {" · "}Via {item.submitted_via === "upload" ? "AI upload" : "manual"}
        {item.verified_at
          ? ` · Verified ${new Date(item.verified_at).toLocaleString()}`
          : ""}
        {item.assigned_to
          ? canAct
            ? " · Assigned to you"
            : " · Assigned to someone else"
          : " · Not assigned yet"}
      </p>

      <div className="mt-4 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
        <p className="font-semibold">How this works</p>
        <p className="mt-1">
          Read each question card against the PDF. Fix the text in plain
          boxes — you do not need to know markdown.
        </p>
        <p className="mt-1">
          Save draft keeps your work. Submit sends it for review.
        </p>
        <p className="mt-1">
          Approve marks this text as the final source for AI Notes, gives
          +25 XP and +5 AI credits to the person who finished it, and the
          item leaves the queue.
        </p>
        <p className="mt-1">
          Needs fix sends it back with your note (a note is required).
        </p>
      </div>

      {lock && !lock.mine && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-100 p-3 text-sm text-amber-900">
          {lock.locked_by_label ?? "Someone"} is editing this now. You can
          still view and suggest, but save after they are done — your save
          will warn you if their version is newer.
        </p>
      )}
      {item.note && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-100 p-3 text-sm text-amber-900">
          Note: {item.note}
        </p>
      )}
      {item.status === "approved" && (
        <p className="mt-3 rounded border border-emerald-700 bg-emerald-50 p-3 text-sm text-emerald-900">
          Approved — this md is the source of truth for AI Notes.
        </p>
      )}
      {conflict && (
        <div className="mt-3 rounded border border-red-700 bg-red-50 p-3 text-sm text-red-900">
          <p>
            Someone saved a newer version while you were working. Your
            changes were not saved.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 border border-red-700 px-3 py-1 font-semibold"
          >
            Reload the latest version
          </button>
        </div>
      )}

      {isFounder && (
        <div className="mt-4 rounded border border-[var(--color-border)] p-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Assign this item (founder only — only the assigned person can
              use the four buttons)
            </span>
            <span className="flex flex-wrap gap-2">
              <select
                value={assignSel}
                onChange={(e) => setAssignSel(e.target.value)}
                className="border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 text-[var(--color-text)]"
              >
                <option value="">Unassigned</option>
                {verifiers.map((v) => (
                  <option key={v.user_id} value={v.user_id}>
                    {v.name || v.email || v.user_id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void assignItem()}
                disabled={assigning}
                className="border px-3 py-1 font-semibold disabled:opacity-50"
              >
                Assign
              </button>
            </span>
          </label>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-base font-bold">Official PDF</h2>
          {item.pdf_key ? (
            <div className="mt-3">
              <PdfLineViewer
                pdfUrl={`/api/md-verification/${item.id}/pdf`}
                target={highlightTarget}
                title={item.paper_code}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">
              No PDF was uploaded for this item yet.
            </p>
          )}
        </section>

        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">
              {useCards ? "Questions" : "Markdown"}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("cards");
                  setEditSource("cards");
                }}
                className={`border px-3 py-1 text-sm ${mode === "cards" ? "font-bold" : ""}`}
                aria-pressed={mode === "cards"}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`border px-3 py-1 text-sm ${mode === "preview" ? "font-bold" : ""}`}
                aria-pressed={mode === "preview"}
              >
                Preview
              </button>
              {isFounder && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("raw");
                    setEditSource("raw");
                  }}
                  className={`border px-3 py-1 text-sm ${mode === "raw" ? "font-bold" : ""}`}
                  aria-pressed={mode === "raw"}
                >
                  Raw text
                </button>
              )}
            </div>
          </div>

          {mode === "cards" && useCards && (
            <div className="mt-3 space-y-4">
              {(parsed.header.fullMarks !== null ||
                parsed.header.passMarks !== null ||
                parsed.header.time !== null) && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {parsed.header.fullMarks !== null && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">
                        Full marks
                      </span>
                      <input
                        value={headerFull}
                        onChange={(e) => setHeaderFull(e.target.value)}
                        inputMode="numeric"
                        disabled={!canAct}
                        className={smallInputCls}
                      />
                    </label>
                  )}
                  {parsed.header.passMarks !== null && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">
                        Pass marks
                      </span>
                      <input
                        value={headerPass}
                        onChange={(e) => setHeaderPass(e.target.value)}
                        inputMode="numeric"
                        disabled={!canAct}
                        className={smallInputCls}
                      />
                    </label>
                  )}
                  {parsed.header.time !== null && (
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">
                        Time
                      </span>
                      <input
                        value={headerTime}
                        onChange={(e) => setHeaderTime(e.target.value)}
                        disabled={!canAct}
                        className="w-32 border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
                      />
                    </label>
                  )}
                </div>
              )}
              {cards.map((card) => (
                <article
                  key={card.key}
                  onMouseEnter={() => setActiveKey(card.key)}
                  onFocus={() => setActiveKey(card.key)}
                  onClick={() => setActiveKey(card.key)}
                  className={`rounded border p-3 ${
                    card.needsFix
                      ? "border-amber-500"
                      : activeKey === card.key
                        ? "border-emerald-600"
                        : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-bold">
                      {card.label}
                      {card.unit ? ` · Unit ${card.unit}` : ""}
                    </h3>
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canAct}
                        onClick={() =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.key === card.key
                                ? { ...c, needsFix: false }
                                : c,
                            ),
                          )
                        }
                        className={`border px-2 py-1 text-xs ${!card.needsFix ? "font-bold" : ""} disabled:opacity-50`}
                        aria-pressed={!card.needsFix}
                      >
                        Looks right
                      </button>
                      <button
                        type="button"
                        disabled={!canAct}
                        onClick={() =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.key === card.key
                                ? { ...c, needsFix: true }
                                : c,
                            ),
                          )
                        }
                        className={`border px-2 py-1 text-xs ${card.needsFix ? "font-bold" : ""} disabled:opacity-50`}
                        aria-pressed={card.needsFix}
                      >
                        Needs fix
                      </button>
                    </span>
                  </div>
                  <textarea
                    value={card.text}
                    onChange={(e) =>
                      setCards((prev) =>
                        prev.map((c) =>
                          c.key === card.key
                            ? { ...c, text: e.target.value }
                            : c,
                        ),
                      )
                    }
                    disabled={!canAct}
                    rows={Math.max(3, card.text.split("\n").length + 1)}
                    className="mt-2 w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2 text-sm text-[var(--color-text)]"
                    aria-label={`${card.label} text`}
                  />
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">
                        Marks
                      </span>
                      <input
                        value={card.marks}
                        onChange={(e) =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.key === card.key
                                ? { ...c, marks: e.target.value }
                                : c,
                            ),
                          )
                        }
                        inputMode="numeric"
                        disabled={!canAct}
                        className={smallInputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold">
                        PDF page
                      </span>
                      <input
                        value={card.page}
                        onChange={(e) =>
                          setCards((prev) =>
                            prev.map((c) =>
                              c.key === card.key
                                ? { ...c, page: e.target.value }
                                : c,
                            ),
                          )
                        }
                        inputMode="numeric"
                        disabled={!canAct}
                        className={smallInputCls}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}

          {mode === "cards" && !useCards && (
            <p className="mt-3 text-sm text-on-surface-variant">
              This md has no numbered questions, so cards are not available
              here. Use Preview to read it, or Raw text (founder) to edit
              it.
            </p>
          )}

          {mode === "preview" && (
            <div className="mt-3 max-h-[70vh] overflow-auto border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3 text-sm text-[var(--color-text)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {editSource === "raw" ? rawDraft : (buildMd() ?? rawDraft)}
              </ReactMarkdown>
            </div>
          )}

          {mode === "raw" && (
            <textarea
              value={rawDraft}
              onChange={(e) => setRawDraft(e.target.value)}
              className="mt-3 h-[70vh] w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] p-3 font-mono text-sm text-[var(--color-text)]"
              aria-label="Markdown text"
              spellCheck={false}
            />
          )}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">
              Note (shown to the next reviewer; required when sending back)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canAct}
              className={inputCls}
              placeholder="e.g. Q3 marks are wrong in the md, PDF says 10"
            />
          </label>
          {dirty && (
            <p className="mt-2 text-xs text-on-surface-variant">
              Unsaved changes.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {savedAt && (
            <p className="mt-2 text-sm text-[var(--color-primary)]">{savedAt}</p>
          )}

          {showActions && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save(false)}
                disabled={saving}
                className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void save(true)}
                disabled={saving}
                className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => void review("approve")}
                disabled={saving}
                className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => void review("needs_fix")}
                disabled={saving || !note.trim()}
                className="border border-red-700 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                Needs fix
              </button>
            </div>
          )}
          {!canAct && item.status !== "approved" && (
            <p className="mt-3 text-sm text-on-surface-variant">
              This item is assigned to someone else, so you cannot use the
              buttons. Suggest an edit below instead.
            </p>
          )}
        </section>
      </div>

      {suggestions.length > 0 && (
        <section className="card mt-6 p-4">
          <h2 className="text-base font-bold">Suggestions</h2>
          <ul className="mt-3 space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded border border-[var(--color-border)] p-3 text-sm"
              >
                <p className="font-semibold">
                  {s.question_ref
                    ? `On ${s.question_ref.toUpperCase()}`
                    : "On the whole paper"}
                  {" · "}
                  {s.author_label ?? "Someone"}
                  {" · "}
                  {s.status}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{s.proposed_text}</p>
                {s.note && (
                  <p className="mt-1 text-on-surface-variant">
                    Note: {s.note}
                  </p>
                )}
                {canAct && s.status === "pending" && (
                  <span className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void decideSuggestion(s.id, "apply")}
                      disabled={saving}
                      className="border px-2 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => void decideSuggestion(s.id, "dismiss")}
                      disabled={saving}
                      className="border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showSuggest && (
        <section className="card mt-6 p-4">
          <h2 className="text-base font-bold">Suggest an edit</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            The assigned verifier sees your suggestion and can apply it in
            one click.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">Question</span>
            <select
              value={suggestRef}
              onChange={(e) => setSuggestRef(e.target.value)}
              className="border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 text-sm text-[var(--color-text)]"
            >
              <option value="">Whole paper</option>
              {cards.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                  {c.unit ? ` (Unit ${c.unit})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">
              Corrected text
            </span>
            <textarea
              value={suggestText}
              onChange={(e) => setSuggestText(e.target.value)}
              rows={4}
              className="w-full border border-[var(--color-border)] bg-[var(--color-input-bg)] p-2 text-sm text-[var(--color-text)]"
              placeholder="Write the question as it should read"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">
              Note (optional)
            </span>
            <input
              value={suggestNote}
              onChange={(e) => setSuggestNote(e.target.value)}
              className={inputCls}
              placeholder="e.g. the PDF spells it differently"
            />
          </label>
          <button
            type="button"
            onClick={() => void submitSuggestion()}
            disabled={saving || !suggestText.trim()}
            className="mt-3 border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Send suggestion
          </button>
          {suggestSent && (
            <p className="mt-2 text-sm text-[var(--color-primary)]">
              Suggestion sent.
            </p>
          )}
        </section>
      )}
      {pendingSuggestions.length > 0 && canAct && (
        <p className="mt-3 text-sm text-on-surface-variant">
          {pendingSuggestions.length} pending suggestion
          {pendingSuggestions.length === 1 ? "" : "s"} above — apply or
          dismiss each one.
        </p>
      )}
    </div>
  );
}

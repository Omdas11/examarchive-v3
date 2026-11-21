"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  STATUS_LABELS,
  type MdVerificationItem,
  type MdVerificationStatus,
} from "@/lib/md-verification";

const STATUS_OPTIONS: Array<"" | MdVerificationStatus> = [
  "",
  "pending",
  "in_review",
  "needs_fix",
  "approved",
];

interface VerifierRow {
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: number;
}

function statusBadge(status: MdVerificationStatus) {
  const colors: Record<MdVerificationStatus, string> = {
    pending: "bg-slate-100 text-slate-700",
    in_review: "bg-blue-100 text-blue-800",
    needs_fix: "bg-red-100 text-red-800",
    approved: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${colors[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function MdVerificationQueue({
  isFounder,
  canSendCodes,
}: {
  isFounder: boolean;
  /** Founder or moderator: may email upload codes to verifiers. */
  canSendCodes: boolean;
}) {
  const [items, setItems] = useState<MdVerificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifiers, setVerifiers] = useState<VerifierRow[]>([]);
  const [verifierEmail, setVerifierEmail] = useState("");
  const [codeEmail, setCodeEmail] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page) });
      if (status) qs.set("status", status);
      if (type) qs.set("type", type);
      if (mine) qs.set("mine", "1");
      const res = await fetch(`/api/md-verification?${qs.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Could not load the queue");
      const data = (await res.json()) as {
        items: MdVerificationItem[];
        total: number;
      };
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the queue");
    } finally {
      setLoading(false);
    }
  }, [page, status, type, mine]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAdmin = useCallback(async () => {
    if (!isFounder) return;
    try {
      const vRes = await fetch("/api/md-verification/verifiers", {
        credentials: "include",
      });
      if (vRes.ok) {
        const data = (await vRes.json()) as { verifiers: VerifierRow[] };
        setVerifiers(data.verifiers);
      }
    } catch {
      // Founder panels are optional decoration; the queue still works.
    }
  }, [isFounder]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  /** Email a 6-char upload code to a verifier (founder / moderator). */
  async function sendCode() {
    if (!codeEmail.trim()) return;
    setAdminBusy(true);
    setAdminError(null);
    setCodeSentTo(null);
    try {
      const res = await fetch("/api/md-verification/upload-codes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: codeEmail.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not send the code");
      setCodeSentTo(codeEmail.trim());
      setCodeEmail("");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not send the code");
    } finally {
      setAdminBusy(false);
    }
  }

  async function assignVerifier() {
    if (!verifierEmail.trim()) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const res = await fetch("/api/md-verification/verifiers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifierEmail.trim(), action: "assign" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not assign the verifier");
      setVerifierEmail("");
      await loadAdmin();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not assign the verifier");
    } finally {
      setAdminBusy(false);
    }
  }

  async function unassignVerifier(userId: string) {
    setAdminBusy(true);
    try {
      const res = await fetch("/api/md-verification/verifiers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, action: "unassign" }),
      });
      if (!res.ok) throw new Error("Could not remove the verifier");
      await loadAdmin();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Could not remove the verifier");
    } finally {
      setAdminBusy(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="border bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s as MdVerificationStatus]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Type</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="border bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="question">Question paper</option>
              <option value="syllabus">Syllabus</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => {
                setMine(e.target.checked);
                setPage(1);
              }}
            />
            Assigned to me
          </label>
          <span className="pb-2 text-sm text-on-surface-variant">
            {total} item{total === 1 ? "" : "s"}
          </span>
          <Link
            href="/admin/md-verification/upload"
            className="mb-1 ml-auto border px-3 py-2 text-sm font-semibold"
          >
            Upload a zip
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No items in this view yet. Uploads from the friend&apos;s AI appear
          here as pending.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/admin/md-verification/${item.id}`}
              className="card block p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{item.paper_code}</p>
                {statusBadge(item.status)}
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {item.type === "question" ? "Question paper" : "Syllabus"}
                {" · "}Batch {item.batch_id}
                {" · "}{item.md_chars ?? 0} chars
                {item.pdf_key ? " · PDF attached" : " · No PDF"}
                {item.assigned_to ? " · Assigned" : ""}
              </p>
              {item.note && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Note: {item.note}
                </p>
              )}
              <p className="mt-1 text-xs text-on-surface-variant">
                Updated {new Date(item.updated_at).toLocaleString()}
              </p>
            </Link>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isFounder && (
        <div className="space-y-6">
          {canSendCodes && (
            <div className="card p-4">
              <h2 className="text-base font-bold">Send verification code</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Email a 6-character upload code to a verifier. The code works
                once, for 24 hours. The verifier enters it on the upload form
                together with their zip file.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={codeEmail}
                  onChange={(e) => setCodeEmail(e.target.value)}
                  className="border bg-white px-3 py-2 text-sm"
                  placeholder="verifier@example.com"
                  aria-label="Verifier email"
                  type="email"
                />
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={adminBusy || !codeEmail.trim()}
                  className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Send verification code
                </button>
              </div>
              {codeSentTo && (
                <p className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
                  Code sent to {codeSentTo}. It works once, for 24 hours. Ask
                  them to check spam and mark it as not spam if it lands
                  there.
                </p>
              )}
              {adminError && <p className="mt-2 text-sm text-red-600">{adminError}</p>}
            </div>
          )}

          <div className="card p-4">
            <h2 className="text-base font-bold">Assigned verifiers</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Verifiers can open this page without a moderator role. Give the
              friend access by email; remove it any time.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
                className="border bg-white px-3 py-2 text-sm"
                placeholder="friend@example.com"
                aria-label="Verifier email"
              />
              <button
                type="button"
                onClick={() => void assignVerifier()}
                disabled={adminBusy || !verifierEmail.trim()}
                className="border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Assign verifier
              </button>
            </div>
            {verifiers.length > 0 && (
              <ul className="mt-3 space-y-2">
                {verifiers.map((v) => (
                  <li
                    key={v.user_id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {v.name ?? v.email ?? v.user_id}
                      {v.email && v.name ? ` (${v.email})` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => void unassignVerifier(v.user_id)}
                      disabled={adminBusy}
                      className="border px-3 py-1 text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

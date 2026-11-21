"use client";

import { useState } from "react";
import Link from "next/link";

export default function MdVerificationUploadForm() {
  const [zip, setZip] = useState<File | null>(null);
  const [paperCode, setPaperCode] = useState("");
  const [type, setType] = useState("question");
  const [batchId, setBatchId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    paper_code: string;
  } | null>(null);

  async function submit() {
    if (!zip) {
      setError("Attach the zip file first.");
      return;
    }
    if (!paperCode.trim() || !code.trim()) {
      setError("Paper code and the 6-character code are both required.");
      return;
    }
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const form = new FormData();
      form.set("zip", zip);
      form.set("paper_code", paperCode.trim());
      form.set("type", type);
      if (batchId.trim()) form.set("batch_id", batchId.trim());
      form.set("code", code.trim());
      const res = await fetch("/api/md-verification/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = (await res.json()) as {
        id?: string;
        paper_code?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "Upload failed");
      }
      setCreated({ id: data.id, paper_code: data.paper_code ?? paperCode });
      setZip(null);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            Zip file — one PDF and one md file inside
          </span>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setZip(e.target.files?.[0] ?? null)}
            className="w-full border bg-white px-3 py-2 text-sm"
          />
          {zip && (
            <span className="mt-1 block text-xs text-on-surface-variant">
              {zip.name} ({Math.round(zip.size / 1024)} KB)
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Paper code</span>
          <input
            value={paperCode}
            onChange={(e) => setPaperCode(e.target.value)}
            className="w-full border bg-white px-3 py-2 text-sm"
            placeholder="e.g. COMDSC-301T"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border bg-white px-3 py-2 text-sm"
          >
            <option value="question">Question paper</option>
            <option value="syllabus">Syllabus</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            Batch id (optional — groups a batch of papers)
          </span>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full border bg-white px-3 py-2 text-sm"
            placeholder="e.g. batch-1-2026-11-21"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">
            6-character code (emailed to you by an admin)
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full border bg-white px-3 py-2 font-mono text-sm tracking-[0.2em]"
            placeholder="ABC123"
            maxLength={6}
            autoComplete="off"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {created && (
          <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
            Uploaded. {created.paper_code} is now pending in the queue.{" "}
            <Link
              href={`/admin/md-verification/${created.id}`}
              className="font-semibold underline"
            >
              Open it to verify
            </Link>
          </p>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  );
}

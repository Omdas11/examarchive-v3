"use client";

import { useState } from "react";

export default function BulkImportPage() {
  const [json, setJson] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("Importing…");
    try {
      const payloads = JSON.parse(json);
      const res = await fetch("/api/admin/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Failed: ${data.error || res.statusText}`);
      } else {
        const failed = (data.results || []).filter((r: { ok: boolean }) => !r.ok);
        setStatus(
          `Done: ${data.created}/${data.total} created.` +
            (failed.length
              ? ` Failures: ${failed.map((f: { paper_code: string; error?: string }) => `${f.paper_code} (${f.error})`).join("; ")}`
              : "")
        );
      }
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : "invalid JSON"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Bulk Import Papers</h1>
      <p>Paste a JSON array of paper payloads (same shape as /api/upload). Files must already be in Appwrite Storage. Papers are created as approved.</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={20}
          style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }}
          placeholder='[{"fileId":"...","paper_code":"...","university":"...","year":2023,...}]'
        />
        <br />
        <button type="submit" disabled={busy} style={{ marginTop: "0.5rem", padding: "0.5rem 1.5rem" }}>
          {busy ? "Importing…" : "Import"}
        </button>
      </form>
      {status && <p style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>{status}</p>}
    </main>
  );
}

#!/usr/bin/env node
/**
 * Phase 4 follow-up — set papers.file_key in remote D1 from the verified
 * file_id -> backup-filename mapping (docs/cloudflare-migration/phase4-file-mapping.json).
 *
 * Same remote-D1 transport as scripts/import-d1.mjs: batched SQL through the
 * Cloudflare API via the MCP `execute` tool (token attached by the MCP helper).
 * Values are SQL-escaped with lit(); file_ids/filenames come from Appwrite +
 * the local backup, but nothing is concatenated unescaped.
 * Updates all 636 papers (the 19 already set get the same value — no-op).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const ACCOUNT_ID = "51f6c2d7ae94e39ffcd63b1e058fd686";
const DATABASE_ID = "69025c94-38e5-4e0c-9205-76382d924485";
const D1_QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const MCP_CLI = "/home/hatch/workspace/custom-connectors/custom.legacy-cloudflare/bin/cloudflare_mcp.py";
const MAPPING = "/home/hatch/workspace/examarchive/examarchive-v3/docs/cloudflare-migration/phase4-file-mapping.json";
const MAX_STMTS = 50;

function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function runBatchRemote(stmts, label) {
  const code =
    "async () => { const batch = " +
    JSON.stringify(stmts.map((sql) => ({ sql }))) +
    "; const r = await fetch(" +
    JSON.stringify(D1_QUERY_URL) +
    ", {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({batch})}); " +
    "const j = await r.json(); if (!j.success) return {ok: false, errors: j.errors}; " +
    "const bad = []; j.result.forEach((x, i) => { if (!x.success) bad.push({i, error: x.error}); }); " +
    "return {ok: bad.length === 0, bad, written: j.result.reduce((a, x) => a + (x.meta ? x.meta.rows_written : 0), 0)}; }";
  const res = spawnSync("python3", [MCP_CLI, "call", "execute", "--args", JSON.stringify({ code, truncate: false })],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`MCP call failed for ${label}: ${(res.stderr || res.stdout || "").slice(0, 500)}`);
  let out;
  try { out = JSON.parse(res.stdout); }
  catch { throw new Error(`MCP unparseable output for ${label}: ${res.stdout.slice(0, 500)}`); }
  if (!out.ok) {
    const first = out.bad && out.bad[0];
    throw new Error(`D1 batch failed for ${label} (stmt ${first ? first.i : "?"}): ${JSON.stringify(first ? first.error : out.errors)}`);
  }
  return out.written;
}

const doc = JSON.parse(fs.readFileSync(MAPPING, "utf8"));
if (doc.mismatches.length || doc.unmapped.length) {
  console.error(`mapping has ${doc.unmapped.length} unmapped + ${doc.mismatches.length} mismatches — refusing to update D1`);
  process.exit(2);
}
const mapping = doc.mapping;
console.log(`updating ${mapping.length} papers`);

// Safety: file_key values are all `papers/<name>` with a safe charset, file_ids are 20 hex chars.
const bad = mapping.filter((m) => !/^[0-9a-f]{20}$/.test(m.file_id) || !/^papers\/[A-Za-z0-9_.\-]+$/.test(m.file_key));
if (bad.length) { console.error(`unsafe values: ${JSON.stringify(bad.slice(0, 3))}`); process.exit(2); }

const stmts = mapping.map(
  (m) => `UPDATE papers SET file_key = ${lit(m.file_key)} WHERE file_id = ${lit(m.file_id)}`
);
let totalWritten = 0;
for (let i = 0; i < stmts.length; i += MAX_STMTS) {
  const chunk = stmts.slice(i, i + MAX_STMTS);
  const written = runBatchRemote(chunk, `file_key chunk ${i / MAX_STMTS + 1}`);
  totalWritten += written;
  console.log(`chunk ${i / MAX_STMTS + 1}/${Math.ceil(stmts.length / MAX_STMTS)}: rows_written=${written}`);
}
console.log(`done: ${stmts.length} UPDATEs, total rows_written=${totalWritten}`);

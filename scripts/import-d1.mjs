#!/usr/bin/env node
/**
 * Phase 4 — import the 2026-11-17 Appwrite backup into D1.
 *
 * Source: ONLY the local backup at ~/workspace/examarchive-backup/2026-11-17/
 * (never reads Appwrite — the old project is at 95%+ reads). The backup JSON
 * files are kept as-is; this script only reads them.
 *
 * Targets:
 *   --target local   apply to a local SQLite file (default, for testing).
 *                    Uses the `sqlite3` CLI. D1 is SQLite, so the same SQL
 *                    applies remotely with `wrangler d1 migrations apply`.
 *   --target remote  apply to the real D1 database `examarchive-db`
 *                    (69025c94-38e5-4e0c-9205-76382d924485) via the Cloudflare
 *                    API through the MCP `execute` tool (the stored API token
 *                    is attached by the MCP helper; this script never sees it).
 *
 * Usage:
 *   node scripts/import-d1.mjs --target local --db /tmp/examarchive-d1.db
 *   node scripts/import-d1.mjs --target remote
 *   node scripts/import-d1.mjs --target local --dry-run   # print counts only
 *   node scripts/import-d1.mjs --target remote --only papers
 *
 * Decisions baked in (see docs/cloudflare-migration/phase4-data-migration.md):
 * - visit_logs is NOT imported (1,147 rows of per-request analytics; the
 *   migration doc says never write to D1 on every page view).
 * - syllabus is NOT imported (0 rows, superseded by syllabus_table).
 * - night_access_codes / night_access_blocks are NOT imported (0 rows;
 *   feature removed 2026-11-14, tables kept for fidelity only).
 * - users are imported WITHOUT passwords (none exist in the backup);
 *   google_sub stays NULL until Phase 5; users re-authenticate via Google.
 * - papers.file_key is set ONLY for the 19 papers whose Appwrite file_id
 *   appears in a backup filename (the backup does not preserve the
 *   file_id -> filename mapping for the other 617; see the Phase 4 report).
 */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const ACCOUNT_ID = "51f6c2d7ae94e39ffcd63b1e058fd686";
const DATABASE_ID = "69025c94-38e5-4e0c-9205-76382d924485";
const D1_QUERY_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
const MCP_CLI = "/home/hatch/workspace/custom-connectors/custom.legacy-cloudflare/bin/cloudflare_mcp.py";
const DEFAULT_BACKUP = "/home/hatch/workspace/examarchive-backup/2026-11-17";
const R2_KEY_PREFIX = "papers/";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);
const TARGET = opt("--target", "local");
const BACKUP_DIR = opt("--backup", DEFAULT_BACKUP);
const LOCAL_DB = opt("--db", "/tmp/examarchive-d1-phase4.db");
const DRY_RUN = has("--dry-run");
const ONLY = opt("--only", null);
const APPLY_MIGRATIONS = !has("--no-migrations");
const MAX_BYTES = Number(opt("--chunk-bytes", "80000"));
const MAX_STMTS = Number(opt("--chunk-stmts", "50"));

if (!["local", "remote"].includes(TARGET)) {
  console.error(`--target must be local or remote (got ${TARGET})`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------
// Mappers return plain JS values (string | number | null); lit() turns a
// value into a SQL literal. Keeping values typed makes the spot-check compare
// DB rows against the same values instead of re-parsing SQL text.
function vStr(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}
function vInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function vBool(v) {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}
function vJson(v) {
  if (v === null || v === undefined) return "[]";
  return JSON.stringify(v);
}
function vDate(v) {
  if (v === null || v === undefined || v === "") return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}
function vDateReq(v, fallback) {
  const ms = Date.parse(v);
  if (Number.isFinite(ms)) return ms;
  return Date.parse(fallback);
}
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function splitSqlFile(text) {
  const lines = text.split("\n").filter((l) => !l.trim().startsWith("--"));
  return lines
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function chunkStatements(stmts) {
  const chunks = [];
  let cur = [];
  let bytes = 0;
  for (const s of stmts) {
    const len = Buffer.byteLength(s, "utf8") + 1;
    if (cur.length > 0 && (bytes + len > MAX_BYTES || cur.length >= MAX_STMTS)) {
      chunks.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(s);
    bytes += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------
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
  const res = spawnSync(
    "python3",
    [MCP_CLI, "call", "execute", "--args", JSON.stringify({ code, truncate: false })],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`MCP call failed for ${label}: ${(res.stderr || res.stdout || "").slice(0, 500)}`);
  }
  let out;
  try {
    out = JSON.parse(res.stdout);
  } catch {
    throw new Error(`MCP returned unparseable output for ${label}: ${res.stdout.slice(0, 500)}`);
  }
  if (!out.ok) {
    const first = out.bad && out.bad[0];
    throw new Error(
      `D1 batch failed for ${label} (stmt ${first ? first.i : "?"}): ${JSON.stringify(first ? first.error : out.errors)}`
    );
  }
  return out.written;
}

function runBatchLocal(stmts, label) {
  const tmp = `/tmp/import-d1-chunk-${process.pid}.sql`;
  fs.writeFileSync(tmp, stmts.map((s) => s + ";").join("\n"));
  const res = spawnSync("sqlite3", [LOCAL_DB, `.read ${tmp}`], { encoding: "utf8" });
  fs.unlinkSync(tmp);
  if (res.status !== 0) {
    throw new Error(`sqlite3 failed for ${label}: ${(res.stderr || "").slice(0, 500)}`);
  }
  return stmts.length;
}

function runBatch(stmts, label) {
  if (DRY_RUN) return stmts.length;
  return TARGET === "remote" ? runBatchRemote(stmts, label) : runBatchLocal(stmts, label);
}

function queryOneRemote(sql) {
  const code =
    "async () => { const r = await fetch(" +
    JSON.stringify(D1_QUERY_URL) +
    ", {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sql: " +
    JSON.stringify(sql) +
    "})}); const j = await r.json(); if (!j.success) return {ok: false, errors: j.errors}; " +
    "return {ok: true, rows: j.result[0].results}; }";
  const res = spawnSync(
    "python3",
    [MCP_CLI, "call", "execute", "--args", JSON.stringify({ code, truncate: false })],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0) throw new Error(`MCP query failed: ${(res.stderr || "").slice(0, 300)}`);
  const out = JSON.parse(res.stdout);
  if (!out.ok) throw new Error(`D1 query failed: ${JSON.stringify(out.errors)}`);
  return out.rows;
}

function queryOneLocal(sql) {
  const res = spawnSync("sqlite3", ["-json", LOCAL_DB, sql], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`sqlite3 query failed: ${(res.stderr || "").slice(0, 300)}`);
  const rows = JSON.parse(res.stdout || "[]");
  return rows;
}

function queryOne(sql) {
  return TARGET === "remote" ? queryOneRemote(sql) : queryOneLocal(sql);
}

// ---------------------------------------------------------------------------
// Backup loading + file_key mapping
// ---------------------------------------------------------------------------
function loadCollection(name) {
  const p = path.join(BACKUP_DIR, `${name}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  return j.documents || [];
}

// papers.file_key: only where the Appwrite file_id appears in exactly one
// backup filename. The backup saved files under their original upload names,
// so 617 of 636 papers have no provable mapping (see Phase 4 report).
function buildFileKeyMap(papers) {
  const files = fs.readdirSync(path.join(BACKUP_DIR, "files", "papers"));
  const map = new Map();
  let matched = 0;
  for (const p of papers) {
    if (!p.file_id) continue;
    const hits = files.filter((f) => f.includes(p.file_id));
    if (hits.length === 1) {
      map.set(p.$id, R2_KEY_PREFIX + hits[0]);
      matched++;
    }
  }
  console.log(`file_key: ${matched} of ${papers.length} papers matched by filename (rest stay NULL)`);
  return map;
}

// ---------------------------------------------------------------------------
// Table definitions: backup collection -> D1 table, columns, row mapper.
// Each mapper returns values in column order; nulls stay NULL.
// ---------------------------------------------------------------------------
function base(doc) {
  return {
    id: randomUUID(),
    legacy_appwrite_id: doc.$id,
    created_at: vDateReq(doc.$createdAt, "2026-11-17T00:00:00.000Z"),
    updated_at: vDate(doc.$updatedAt),
  };
}

const TABLES = [
  {
    collection: "users",
    table: "users",
    columns: [
      "id", "email", "name", "display_name", "username", "avatar_url", "google_sub",
      "role", "primary_role", "secondary_role", "tertiary_role", "tier", "xp",
      "streak_days", "last_activity", "upload_count", "username_last_changed",
      "referral_code", "ai_credits", "referred_by", "referral_path", "discord_id",
      "discord_username", "discord_avatar", "discord_in_server",
      "legacy_appwrite_id", "created_at", "updated_at",
    ],
    map: (d) => {
      const b = base(d);
      return [
        vStr(b.id), vStr(d.email), vStr(d.display_name), vStr(d.display_name),
        vStr(d.username), vStr(d.avatar_url), null, // google_sub: NULL until Phase 5
        vStr(d.role || "user"), vStr(d.primary_role), vStr(d.secondary_role),
        vStr(d.tertiary_role), vStr(d.tier), vInt(d.xp ?? 0),
        vInt(d.streak_days ?? 0), vDate(d.last_activity), vInt(d.upload_count ?? 0),
        vStr(d.username_last_changed), vStr(d.referral_code), vInt(d.ai_credits ?? 0),
        vStr(d.referred_by), vJson(d.referral_path), vStr(d.discord_id),
        vStr(d.discord_username), vStr(d.discord_avatar), vBool(d.discord_in_server) ?? 0,
        vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
  {
    collection: "papers",
    table: "papers",
    columns: [
      "id", "course_code", "paper_name", "year", "semester", "department", "programme",
      "exam_type", "institute", "institution", "stream", "paper_type", "marks",
      "duration", "file_id", "file_url", "file_key", "uploaded_by",
      "uploaded_by_username", "approved", "status", "view_count", "download_count",
      "source_name", "source_url", "legacy_appwrite_id", "created_at", "updated_at",
    ],
    map: (d, ctx) => {
      const b = base(d);
      const key = ctx.fileKeys.get(d.$id);
      return [
        vStr(b.id), vStr(d.course_code ?? ""), vStr(d.paper_name), vInt(d.year),
        vStr(d.semester), vStr(d.department), vStr(d.programme), vStr(d.exam_type),
        vStr(d.institute), vStr(d.institution), vStr(d.stream), vStr(d.paper_type),
        vInt(d.marks), vInt(d.duration), vStr(d.file_id), vStr(d.file_url ?? ""),
        key ? vStr(key) : null, vStr(d.uploaded_by), vStr(d.uploaded_by_username),
        vBool(d.approved) ?? 0, vStr(d.status), vInt(d.view_count ?? 0),
        vInt(d.download_count ?? 0), vStr(d.source_name), vStr(d.source_url),
        vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
  {
    collection: "Syllabus_Table",
    table: "syllabus_table",
    columns: [
      "id", "entry_type", "entry_id", "college", "university", "course", "stream",
      "\"group\"", "session", "year", "type", "paper_code", "paper_name", "subject",
      "semester_code", "semester_no", "semester", "credits", "marks_total",
      "syllabus_pdf_url", "source_reference", "status", "aliases", "keywords",
      "notes", "version", "last_updated", "unit_number", "syllabus_content",
      "lectures", "tags", "legacy_appwrite_id", "created_at", "updated_at",
    ],
    map: (d) => {
      const b = base(d);
      return [
        vStr(b.id), vStr(d.entry_type), vStr(d.entry_id), vStr(d.college),
        vStr(d.university ?? ""), vStr(d.course ?? ""), vStr(d.stream ?? ""),
        vStr(d.group), vStr(d.session), vInt(d.year), vStr(d.type ?? ""),
        vStr(d.paper_code ?? ""), vStr(d.paper_name), vStr(d.subject),
        vStr(d.semester_code), vInt(d.semester_no), vInt(d.semester),
        vInt(d.credits), vInt(d.marks_total), vStr(d.syllabus_pdf_url),
        vStr(d.source_reference), vStr(d.status), vJson(d.aliases),
        vJson(d.keywords), vStr(d.notes), vInt(d.version), vStr(d.last_updated),
        vInt(d.unit_number ?? 0), vStr(d.syllabus_content ?? ""), vInt(d.lectures),
        vJson(d.tags), vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
  {
    collection: "syllabus_stats",
    table: "syllabus_stats",
    columns: ["id", "paper_code", "view_count", "download_count", "legacy_appwrite_id", "created_at", "updated_at"],
    map: (d) => {
      const b = base(d);
      return [
        vStr(b.id), vStr(d.paper_code ?? ""), vInt(d.view_count ?? 0),
        vInt(d.download_count ?? 0), vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
  {
    collection: "user_activity",
    table: "user_activity",
    columns: ["id", "user_id", "action", "scope", "title", "href", "paper_ref", "legacy_appwrite_id", "created_at", "updated_at"],
    map: (d) => {
      const b = base(d);
      return [
        vStr(b.id), vStr(d.user_id ?? ""), vStr(d.action ?? ""), vStr(d.scope ?? ""),
        vStr(d.title ?? ""), vStr(d.href ?? ""), vStr(d.paper_ref ?? ""),
        vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
  {
    collection: "site_metrics",
    table: "site_metrics",
    columns: ["id", "visitor_count", "launch_progress", "legacy_appwrite_id", "created_at", "updated_at"],
    map: (d) => {
      const b = base(d);
      return [
        "singleton", vInt(d.visitor_count ?? 0), vInt(d.launch_progress),
        vStr(b.legacy_appwrite_id), b.created_at, b.updated_at,
      ];
    },
  },
];

// Tables deliberately NOT imported (0 rows or retention decision).
const SKIPPED = [
  ["visit_logs", "1,147 rows — per-request analytics (raw IPs + user agents); MD Section 2 says never write to D1 on every page view. Not imported."],
  ["syllabus", "0 rows — superseded by syllabus_table."],
  ["night_access_codes", "0 rows — nightly closure removed 2026-11-14; deprecated."],
  ["night_access_blocks", "0 rows — nightly closure removed 2026-11-14; deprecated."],
  ["Generated_Notes_Cache", "0 rows."],
  ["Questions_Table", "0 rows."],
  ["User_Quotas", "0 rows."],
  ["achievements", "0 rows."],
  ["activity_logs", "0 rows."],
  ["ai_admin_reports", "0 rows."],
  ["ai_cache_index", "0 rows."],
  ["ai_embeddings", "0 rows."],
  ["ai_flashcards", "0 rows."],
  ["ai_generation_jobs", "0 rows."],
  ["ai_ingestions", "0 rows."],
  ["ai_syllabus_maps", "0 rows."],
  ["ai_usage", "0 rows."],
  ["content_verifications", "0 rows."],
  ["feedback", "0 rows."],
  ["pdf_usage", "0 rows."],
  ["purchases", "0 rows."],
  ["uploads", "0 rows."],
  ["user_badges", "0 rows."],
  ["user_passes", "0 rows."],
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log(`Phase 4 D1 import — target=${TARGET} backup=${BACKUP_DIR}`);
  if (TARGET === "local" && !DRY_RUN && fs.existsSync(LOCAL_DB)) {
    fs.unlinkSync(LOCAL_DB);
    console.log(`removed existing local DB ${LOCAL_DB}`);
  }

  // 1. Apply Phase 3 migrations.
  if (APPLY_MIGRATIONS) {
    const files = ["0001_init.sql", "0002_syllabus.sql", "0003_activity.sql", "0004_commerce.sql", "0005_ai.sql"];
    for (const f of files) {
      const stmts = splitSqlFile(fs.readFileSync(path.join(REPO, "migrations", f), "utf8"));
      const chunks = chunkStatements(stmts);
      let done = 0;
      for (const c of chunks) done += runBatch(c, `migration ${f}`);
      console.log(`migration ${f}: ${stmts.length} statements in ${chunks.length} chunk(s)`);
    }
  } else {
    console.log("migrations skipped (--no-migrations)");
  }

  // 2. Import data tables.
  const ctx = { fileKeys: new Map() };
  const expected = {};
  const importedDocs = {};
  for (const t of TABLES) {
    if (ONLY && t.table !== ONLY) continue;
    const docs = loadCollection(t.collection);
    expected[t.table] = docs.length;
    if (t.table === "papers") ctx.fileKeys = buildFileKeyMap(docs);
    const stmts = docs.map(
      (d) => `INSERT INTO ${t.table} (${t.columns.join(", ")}) VALUES (${t.map(d, ctx).map(lit).join(", ")})`
    );
    const chunks = chunkStatements(stmts);
    let done = 0;
    for (const c of chunks) done += runBatch(c, `import ${t.table}`);
    importedDocs[t.table] = docs;
    console.log(`import ${t.table}: ${docs.length} rows in ${chunks.length} chunk(s)`);
  }
  for (const [name, why] of SKIPPED) {
    if (ONLY) continue;
    console.log(`skip ${name}: ${why}`);
  }

  if (DRY_RUN) {
    console.log("dry run — nothing written");
    return;
  }

  // 3. Verify row counts.
  console.log("--- verify row counts ---");
  let allOk = true;
  const tablesToCheck = ONLY ? [ONLY] : [...Object.keys(expected), ...SKIPPED.map(([n]) => n)];
  for (const table of tablesToCheck) {
    const rows = queryOne(`SELECT COUNT(*) AS n FROM ${table}`);
    const got = rows[0].n;
    const want = expected[table] ?? 0;
    const ok = got === want;
    if (!ok) allOk = false;
    console.log(`${table}: D1=${got} backup=${want} ${ok ? "OK" : "MISMATCH"}`);
  }

  // 4. Spot-check 10 random records field by field (papers + syllabus_table + users).
  console.log("--- spot-check 10 random records ---");
  const picks = [];
  const pickFrom = (table, docs, n) => {
    const idx = new Set();
    while (idx.size < Math.min(n, docs.length)) idx.add(Math.floor(Math.random() * docs.length));
    for (const i of idx) picks.push({ table, doc: docs[i] });
  };
  if (!ONLY || ONLY === "papers") pickFrom("papers", importedDocs.papers || loadCollection("papers"), 5);
  if (!ONLY || ONLY === "syllabus_table") pickFrom("syllabus_table", importedDocs.syllabus_table || loadCollection("Syllabus_Table"), 4);
  if (!ONLY || ONLY === "users") pickFrom("users", importedDocs.users || loadCollection("users"), 1);
  let spotOk = 0;
  for (const { table, doc } of picks.slice(0, 10)) {
    const def = TABLES.find((t) => t.table === table);
    const cols = def.columns.filter((c) => c !== "id" && c !== "legacy_appwrite_id" && c !== "created_at" && c !== "updated_at");
    const rows = queryOne(
      `SELECT ${def.columns.map((c) => c).join(", ")} FROM ${table} WHERE legacy_appwrite_id = ${lit(doc.$id)}`
    );
    if (rows.length !== 1) {
      console.log(`FAIL ${table} ${doc.$id}: ${rows.length} rows found`);
      allOk = false;
      continue;
    }
    const row = rows[0];
    const want = def.map(doc, ctx);
    const mismatches = [];
    def.columns.forEach((col, i) => {
      if (col === "id") return; // new uuid, not comparable
      const gotVal = row[col.replace(/"/g, "")];
      const wantVal = want[i];
      if (String(gotVal ?? null) !== String(wantVal ?? null)) {
        mismatches.push(`${col}: db=${JSON.stringify(gotVal)} want=${JSON.stringify(wantVal)}`);
      }
    });
    if (mismatches.length === 0) {
      console.log(`OK ${table} ${doc.$id}`);
      spotOk++;
    } else {
      console.log(`FAIL ${table} ${doc.$id}: ${mismatches.join("; ")}`);
      allOk = false;
    }
  }
  console.log(`spot-check: ${spotOk}/${Math.min(10, picks.length)} OK`);
  console.log(allOk ? "VERIFY: ALL OK" : "VERIFY: MISMATCHES — see above");
  if (!allOk) process.exit(1);
}

main();

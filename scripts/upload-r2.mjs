#!/usr/bin/env node
/**
 * Phase 4 — upload the 667 backup PDFs to the R2 bucket `examarchive-papers`.
 *
 * Key scheme: papers/<original-backup-filename>
 * The backup saved files under their original upload names, and those names
 * are unique across the bucket (the 5 same-name collisions were already
 * disambiguated in the backup with the Appwrite file ID appended, e.g.
 * `name_<fileId>.pdf`). All 667 names are URL-safe ([A-Za-z0-9_.-] only,
 * no spaces), so the filename itself is a clean, collision-free R2 key.
 *
 * Why not papers/{fileId}.pdf? The backup does NOT preserve the
 * file_id -> filename mapping for 617 of 636 papers (only 19 filenames
 * contain their file_id). Uploading under fileId keys would need that
 * mapping; see docs/cloudflare-migration/phase4-data-migration.md and the
 * `papers.file_key` column (set for the 19 provable matches only).
 * Once the remap lands, keys can be renamed in R2 (copy + delete) and
 * papers.file_key updated — the D1 rows keep legacy_appwrite_id + file_id.
 *
 * Requires: wrangler installed AND logged in (`wrangler login` — owner
 * browser step). This script never handles credentials itself; it just
 * calls `wrangler r2 object put` / `wrangler r2 object list`.
 *
 * Usage:
 *   node scripts/upload-r2.mjs --dry-run        # list keys + manifest, upload nothing
 *   node scripts/upload-r2.mjs                  # upload all 667 files
 *   node scripts/upload-r2.mjs --limit 5        # upload first 5 (smoke test)
 *   node scripts/upload-r2.mjs --verify         # list bucket, compare count to 667
 *   node scripts/upload-r2.mjs --skip-existing  # skip keys already in the bucket
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BACKUP_DIR = "/home/hatch/workspace/examarchive-backup/2026-11-17";
const FILES_DIR = path.join(BACKUP_DIR, "files", "papers");
const BUCKET = "examarchive-papers";
const KEY_PREFIX = "papers/";
// Object already in the bucket before Phase 4 (leftover from the bucket's
// earlier use, 2026-01-18; NOT one of the 667 backup files). The upload does
// not touch it, and --verify reports it separately instead of as "extra".
const KNOWN_PRE_EXISTING = ["AU-FYUG-PHYDSC101T-2024.pdf"];
const MANIFEST_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "docs",
  "cloudflare-migration",
  "phase4-r2-manifest.json"
);

const argv = process.argv.slice(2);
const has = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const DRY_RUN = has("--dry-run");
const VERIFY_ONLY = has("--verify");
const SKIP_EXISTING = has("--skip-existing");
const LIMIT = Number(opt("--limit", "0")) || Infinity;

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listLocalFiles() {
  return fs
    .readdirSync(FILES_DIR)
    .filter((f) => f.endsWith(".pdf"))
    .sort()
    .map((name) => {
      const localPath = path.join(FILES_DIR, name);
      return { name, key: KEY_PREFIX + name, localPath, size: fs.statSync(localPath).size };
    });
}

function wrangler(args, { allowFail = false } = {}) {
  const res = spawnSync("wrangler", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0 && !allowFail) {
    throw new Error(`wrangler ${args.join(" ")} failed: ${(res.stderr || res.stdout || "").slice(0, 400)}`);
  }
  return res;
}

function checkWrangler() {
  const res = spawnSync("which", ["wrangler"], { encoding: "utf8" });
  if (res.status !== 0) {
    console.error("BLOCKED: `wrangler` is not installed in this environment.");
    console.error("Install it (`npm i -g wrangler`) and run `wrangler login` (owner browser step), then re-run this script.");
    process.exit(3);
  }
  // A cheap auth probe: `wrangler whoami` fails fast when not logged in.
  const who = wrangler(["whoami"], { allowFail: true });
  if (who.status !== 0) {
    console.error("BLOCKED: wrangler is not logged in.");
    console.error((who.stderr || who.stdout || "").slice(0, 300));
    console.error("Owner step: run `wrangler login` (browser), then re-run this script.");
    process.exit(3);
  }
  console.log(`wrangler OK: ${(who.stdout || "").trim().split("\n")[0]}`);
}

function listRemoteKeys() {
  // `wrangler r2 object list` prints JSON objects, one per line with --output json? Use plain output and parse names.
  const res = wrangler(["r2", "object", "list", BUCKET, "--output", "json"], { allowFail: true });
  if (res.status !== 0) {
    throw new Error(`could not list R2 bucket: ${(res.stderr || res.stdout || "").slice(0, 300)}`);
  }
  const objs = JSON.parse(res.stdout || "[]");
  return new Set(objs.map((o) => o.key));
}

function main() {
  const files = listLocalFiles();
  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  console.log(`local backup: ${files.length} PDFs, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);
  if (files.length !== 667) {
    console.error(`WARNING: expected 667 files, found ${files.length}`);
  }

  // Manifest (filenames, sizes, hashes) — written on --dry-run and after upload.
  const manifest = {
    bucket: BUCKET,
    key_prefix: KEY_PREFIX,
    generated: new Date().toISOString(),
    file_count: files.length,
    total_bytes: totalBytes,
    files: files.map((f) => ({ key: f.key, name: f.name, size: f.size, sha256: sha256(f.localPath) })),
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest written: ${MANIFEST_PATH}`);

  if (DRY_RUN) {
    console.log("dry run — keys that would be uploaded (first 5):");
    for (const f of files.slice(0, 5)) console.log(`  ${f.key} (${(f.size / 1024).toFixed(0)} KiB)`);
    console.log(`... and ${files.length - 5} more. Nothing uploaded.`);
    return;
  }

  checkWrangler();

  if (VERIFY_ONLY) {
    const remote = listRemoteKeys();
    const localKeys = new Set(files.map((f) => f.key));
    const missing = [...localKeys].filter((k) => !remote.has(k));
    const preExisting = KNOWN_PRE_EXISTING.filter((k) => remote.has(k));
    const extra = [...remote].filter((k) => !localKeys.has(k) && !KNOWN_PRE_EXISTING.includes(k));
    console.log(`R2 bucket ${BUCKET}: ${remote.size} objects (expect ${localKeys.size} + ${preExisting.length} pre-existing)`);
    console.log(`local files: ${localKeys.size}; missing in R2: ${missing.length}; extra in R2: ${extra.length}; pre-existing kept: ${preExisting.length}`);
    if (missing.length) console.log("missing (first 10):", missing.slice(0, 10));
    if (extra.length) console.log("extra (first 10):", extra.slice(0, 10));
    console.log(missing.length === 0 && extra.length === 0 ? "VERIFY: R2 matches backup" : "VERIFY: MISMATCH");
    if (missing.length || extra.length) process.exit(1);
    return;
  }

  let existing = new Set();
  if (SKIP_EXISTING) {
    existing = listRemoteKeys();
    console.log(`bucket already has ${existing.size} objects; skipping those`);
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const f of files.slice(0, LIMIT)) {
    if (existing.has(f.key)) {
      skipped++;
      continue;
    }
    const res = wrangler(["r2", "object", "put", `${BUCKET}/${f.key}`, "--file", f.localPath, "--remote"], { allowFail: true });
    if (res.status !== 0) {
      failed++;
      console.error(`FAIL ${f.key}: ${(res.stderr || res.stdout || "").slice(0, 200)}`);
      if (failed >= 5) {
        console.error("5 failures — stopping.");
        break;
      }
    } else {
      uploaded++;
      if (uploaded % 100 === 0) console.log(`... ${uploaded} uploaded`);
    }
  }
  console.log(`done: uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  if (failed) process.exit(1);
}

main();

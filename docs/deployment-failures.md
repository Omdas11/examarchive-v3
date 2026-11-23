# Deployment failures we hit (and how to never hit them again)

Real incidents from the Cloudflare deployment of this site, Nov 2026.
Each entry: what broke, why, the fix, and the check that would have caught it.

---

## 1. Every page 500 after deploy — `Dynamic require of "/.next/server/middleware-manifest.json" is not supported`

**When:** 22–23 Nov 2026. Four deploys in a row (full Supporter-popup branch,
a clean rebuild, a popup-only bisect, a fresh-worktree deploy of the same
commit). Every one rolled back. Live stayed on the pre-popup build.

**Symptom:** every page 500. `wrangler tail` showed
`Error: Dynamic require of "/.next/server/middleware-manifest.json" is not supported`.
The popup code was innocent — the wiring-only bisect broke the site the same way.

**Root cause:** the worktrees were created with `node_modules` **symlinked** to
the main tree's `node_modules`. That silently disables OpenNext's
`patchNextServer` patching of `next-server.js`:

- `next build` resolves the symlink, so the build trace
  `.next/next-server.js.nft.json` lists only **~30 files** (a good build lists
  **~1884**), recording Next.js internals **outside** the worktree
  (`../../examarchive/examarchive-v3/node_modules/...`).
- OpenNext copies the traced files to a stray
  `.open-next/server-functions/examarchive/examarchive-v3/node_modules/...`
  location and patches **that** copy.
- esbuild bundles from `server-functions/default/node_modules/` — the symlink
  to the main tree's **stock, unpatched** `next-server.js`.
- So the deployed handler keeps the stock
  `getMiddlewareManifest(){ return this.minimalMode ? null : require(this.middlewareManifestPath) }`
  instead of the patched `getMiddlewareManifest(){ return null }`, and every
  request hits `getMiddleware()` → dynamic `require()` → the esbuild shim
  throws → 500.

**Proof on disk (good build vs broken build):** good `handler.mjs` has the
stubbed `getMiddlewareManifest(){return null}`, **zero**
`require(this.middlewareManifestPath`, and all 3 `patchNextServer`
"should not be called with OpenNext" stubs (imageOptimizer, runMiddleware,
runEdgeFunction). The broken build had the stock require and **zero** stubs.

**Fix:** rebuild from a tree with a **real** `node_modules` directory —
`npm ci` inside the worktree (never a symlink) — then rebuild and deploy.
The proper rebuild (23 Nov 2026, Worker `c66b427f`) passed all checks and
went live cleanly.

**Rule: NEVER deploy from a worktree whose `node_modules` is a symlink.**

### Pre-deploy checks (all must hold in a fresh `.open-next`, or STOP)

1. `handler.mjs` contains `getMiddlewareManifest(){return null}` and **zero**
   `require(this.middlewareManifestPath`.
2. All 3 "should not be called with OpenNext" stubs present.
3. `server-functions/default/node_modules` is a **real directory**, not a symlink.
4. `.next/next-server.js.nft.json` lists **~1884 files** with
   `../node_modules/...` paths — not ~30 files with `../../examarchive/...`.
5. The new feature's strings are present in the built chunks.
6. After deploy, verify the new string on the **live** page, not just in the build.

---

## 2. Pages 404 on live even though the code exists — uncommitted files were never built

**When:** 23 Nov 2026. `/notices` and `/exam-timetable` returned the site's
404 page on live, and the sidebar entries were missing. The WhatsApp channel
popup was also silently gone from the live build.

**Root cause:** those page files existed only as **uncommitted files in the
main tree** (created after the last build). The Nov 22 "live" deploys came
from that dirty tree. Every later deploy came from a **clean worktree**,
which did not contain the uncommitted files — so the pages were dropped
without any error. Nothing in the deploy warns you about this.

**Fix:** copy only the missing files (plus their exact tracked-file hunks)
into a clean worktree, commit them on a branch, rebuild, redeploy, merge
into `migrate/cloudflare`. Restored 23 Nov 2026 (Worker `1beaef08`).

**Rule: a feature is not live until it is committed on a branch that is
merged into `migrate/cloudflare` and deployed from a clean build. A dirty-tree
deploy is a one-off that the next clean deploy will erase.**

---

## 3. A clean checkout cannot build — local D1 has no tables

**When:** 23 Nov 2026 (fresh worktree builds).

**Symptom:** `Error: D1_ERROR: no such table: papers: SQLITE_ERROR` while
prerendering `/`. The build prerenders the homepage against the **local**
miniflare D1, and a fresh checkout has no tables. The main tree only built
because its `.wrangler/state` held accumulated local state.

**Fix:** before building in a fresh tree, run

```sh
wrangler d1 migrations apply examarchive-db --local
```

(15 migrations, empty tables.) "Clean rebuild" is only reproducible with
that step.

---

## 4. `wr.py deploy` does not rebuild `.open-next` — stale deploys

**When:** 21 Nov 2026 (deployed commit `50196ea`, live site still ran the
older build; caught because the About page lacked a new row).

**Root cause:** `npm run build` is only `next build` (writes `.next/`).
`.open-next/` is written only by `opennextjs-cloudflare build`. `wr.py deploy`
runs plain `wrangler deploy` and pushes whatever `.open-next/` currently holds.

**Deploy sequence (always):**

```sh
npm run build            # with TMPDIR on the main disk, see §5
./node_modules/.bin/opennextjs-cloudflare build
# verify the new string is in .open-next/.../page.js
python3 <goal-hidden-files>/wr_direct.py deploy
# verify the new string on the LIVE page
```

---

## 5. `/tmp` is a 512 MB tmpfs — builds die with "no space left on device"

`opennextjs-cloudflare build` writes esbuild temp files to `$TMPDIR`
(default `/tmp`). When `/tmp` fills, the build dies before Next compiles.

**Fix:** build with temp on the main disk:

```sh
mkdir -p /home/hatch/tmp && export TMPDIR=/home/hatch/tmp
```

Check `df -h /tmp` first if a build fails this way.

---

## 6. This clone only fetches `main` — other branches are invisible

**When:** 23 Nov 2026. `git branch -r` showed only `main`, and
`git rev-parse origin/migrate/cloudflare` failed, even though the branch
existed on GitHub (verified via `git ls-remote origin`). Pushes from the
popup/restore work had landed; only the local fetch was blind to them.

**Root cause:** the clone's fetch refspec is
`+refs/heads/main:refs/remotes/origin/main` only. Plain `git fetch origin`
never brings in other branches.

**Fix:**

```sh
git fetch origin +refs/heads/<branch>:refs/remotes/origin/<branch>
```

Verify with `git rev-parse origin/<branch>` afterwards.

---

## 7. Related gotchas (same era)

- **Jest hangs with zero output in this VM.** If jest shows no output in
  ~2 min, kill it and verify the pure logic via `tsc` + `node` instead.
  Do not block a deploy on a hung jest run.
- **D1 migrations journal can drift.** If `migrations apply` fails on a
  duplicate column, check the `d1_migrations` journal first — the objects
  may already exist while the journal row is missing; insert the missing
  journal row, then re-run.
- **WAF rule updates:** the per-rule PUT returns 10405. Update a rule by
  PUTting the **whole ruleset** (preserving every rule's
  `action_parameters`), then read the ruleset back and verify.
- **Rollback needs the full Worker version UUID** — the short prefix fails.
  Always record the full version id before deploying.

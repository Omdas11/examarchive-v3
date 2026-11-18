# Phase 6 — Port the App Code (Cloudflare migration) — progress

- **Date:** 2026-11-18
- **Branch:** `migrate/cloudflare`
**Status:** exam-critical path DONE 2026-11-18 (cutover push) — homepage,
  browse/paper/search, and R2 PDF downloads (Turnstile-gated, guest) all
  ported and verified on local preview. Auth, uploads, AI routes, and the
  syllabus are NOT ported (see below).

## What was ported

### New data-access layer — `src/lib/d1.ts`

All D1 access goes through here; pages never write SQL directly.

| Function | What it does |
|---|---|
| `getPapers(filters)` | Paginated approved-paper list (department / year / semester / programme / free-text), newest first, with total count |
| `getAllApprovedPapersD1()` | All approved papers, cached 24h (shared list behind the browse-family pages) |
| `getPaperD1(id)` | One paper by D1 id **or** `legacy_appwrite_id`, so old `/paper/<Appwrite id>` links keep working; cached 24h |
| `getRelatedPapersD1(code, excludeId)` | Same-course-code papers (multi-year view); cached 24h |
| `getPaperCountsD1(id)` | Fresh view/download totals from the paper row |
| `searchPapers(q, limit)` | Indexed LIKE search on course code / paper name / department, capped |
| `searchSyllabus(q, limit)` | Search on the `syllabus` table (empty in current data — parity only) |
| `getHomepageStatsD1()` | Paper count, distinct syllabus paper count, user count, 8 newest papers, 3 feedback entries; cached 1h (homepage page itself NOT yet switched — see below) |

Rules enforced in the layer: parameterized queries only
(`.prepare(...).bind(...)`, user input never concatenated into SQL;
`%`/`_` escaped in LIKE patterns); explicit column lists, never
`SELECT *`; no writes on read paths; no silent Appwrite fallback — a
missing D1 binding throws loudly. Binding comes from
`getCloudflareContext({ async: true })` (works in the Worker, in
`next dev` via `initOpenNextCloudflareForDev()`, and during static
generation via wrangler's platform proxy).

### Pages / routes switched to D1

| Page / route | Change |
|---|---|
| `src/lib/papers-cache.ts` | `getAllApprovedPapers` now reads D1 (same export, same 24h cache). This ports **/browse, /papers/[dept], /fyug-question-papers, /assam-university-question-papers, /cbcs-question-papers** in one move — none of them had direct Appwrite calls. |
| `src/app/paper/[id]/page.tsx` | Paper lookup, related papers, and live counts now come from D1. **Per-view counting removed on this branch:** `recordPaperViewIfHuman` is no longer called — the migration forbids writing to D1 on every page view, and the Appwrite counter is not available here. Counts shown are the stored totals. A batched/aggregated counter design is still to come. UI unchanged. |
| `src/app/api/search/route.ts` | Suggestions now come from D1 (`searchPapers` + `searchSyllabus`). Note: the old query searched Appwrite `course_name`, which does not exist as an attribute in the new project; the D1 version searches paper name / course code / department. Response shape unchanged. |
| `src/app/paper/[id]/page.test.tsx`, `metadata.test.ts` | Mocks updated from `@/lib/appwrite` to `@/lib/d1`. Both pass. |

## Verification (cutover push, 2026-11-18, local preview :8787)

- Homepage 200 — "636 papers · 30 syllabi · 3 students" (30 = local D1
  seed; remote D1 has the full 2,585 syllabus rows = 517).
- Browse 200 ("636 papers"), paper page 200 (PHYDSC352T),
  /api/search?q=PHYDSC 200 with real suggestions.
- PDF view with valid ctoken: 200, `application/pdf`, 258,862 bytes,
  `Content-Disposition: inline`, bytes identical to source PDF.
- PDF download (`download=1`): 200, `attachment` with correct filename,
  258,862 bytes. No-ctoken guest: 307 -> /login (gate holds).
  Unknown fileId + valid ctoken: 404. Bot UA: 403.
- `npm run build` passes. Jest: 9 failed / 403 passed / 412 total —
  the 9 are the same pre-existing failures (CreditIcon, Header,
  PaperCard, roles, pdf-generator x2); the 7 fewer tests vs the 419
  baseline are Appwrite-specific tests removed from the homepage and
  file-route suites, not regressions.
- Paper-to-file mapping: 636/636 in remote D1 (commit b6e5c91; the
  Appwrite Storage file-list worked despite 100% DB reads).

## NOT ported (and why)

**Homepage (`src/app/page.tsx`)** — PORTED 2026-11-18 (today, cutover push):
  `getHomepageData` (Appwrite) replaced with `getHomepageStatsD1()` from
  `src/lib/d1.ts`; Appwrite imports removed. The other agent's uncommitted
  "Submit a paper" link was preserved. `getServerUser()` still called —
  returns null for guests (auth deferred, Phase 5), so the page renders
  logged-out. Tests rewritten to mock `@/lib/d1` (3/3 pass).
- **Auth / login** — Phase 5 (needs the owner's Google Cloud Console
  steps). `getServerUser()` still reads Appwrite; pages render logged-out
  on this branch until Phase 5 lands.
- **Uploads (admin), Turnstile verification, AI routes, pdf-generator**
  — not touched.
- **Syllabus** — disabled (503) by design; not ported. `syllabus-cache.ts`
  still reads Appwrite but nothing calls it from a live page.
**`/api/files/papers/[fileId]`** — PORTED to R2 2026-11-18 (commit
  ef8f915): D1 lookup by `file_id` -> R2 `PAPERS` get by `file_key`;
  Turnstile `ctoken`/signed-token gate and bot block kept; guests with a
  valid `ctoken` get the PDF with no login; `inline` for View,
  `attachment` for `download=1`. Watermark skipped (`lib/pdf-watermark`
  reads a font via `node:fs`, unavailable on Workers); counters read-only;
  AI/Gotenberg path returns 404. `getPaperByFileId` added to `src/lib/d1.ts`
  (deliberately uncached). `/api/turnstile-download` needed no changes.
- **View/download counters** — read-only on this branch (see above); no
  increment path exists yet for D1.

## Verification

- `npm run build` — passes (`Compiled successfully`, 112 pages).
- `npx jest --runInBand --forceExit` — **410 passed, 9 failed (6
  suites)**. Identical to the clean-HEAD baseline run (same 6 suites,
  same 9 tests: CreditIcon, Header, PaperCard, roles, pdf-generator x2)
  — all pre-existing, none touched by this phase. The two paper-page
  test suites pass.
- Local preview (`opennextjs-cloudflare preview`, :8787) against a
  local D1 seeded from the 2026-11-17 backup (636 papers, 3 users,
  30 syllabus rows; scratch seeder in `/tmp/seed_local_d1.py`, not
  committed): **/browse 200** (renders "636 papers" + real codes),
  **/paper/\<legacy Appwrite id\> 200**, **/paper/\<D1 id\> 200**,
  **/api/search?q=PHYDSC 200** with real suggestions. Homepage 200
  (still Appwrite-backed, shows zeros without Appwrite env — expected,
  not yet ported).
- Local D1 migrations applied with `wrangler d1 migrations apply
  examarchive-db --local`. Remote D1 / R2 / DNS untouched; nothing
  pushed to main; no Appwrite data touched.

## Follow-ups

1. ~~Swap the homepage's `getHomepageData` for `getHomepageStatsD1()`~~ — DONE 2026-11-18.
2. ~~R2 file serving for `/api/files/papers/[fileId]`~~ — DONE 2026-11-18 (commit ef8f915).
3. Design the batched view/download counter (no per-view D1 writes).
4. Phase 5 auth, then the remaining Appwrite-backed pages
   (/profile, /dashboard, admin, /api/visitor, payments).

## Still needs the owner (cutover blockers)

- `wrangler login` (owner browser step), then:
  `npm run deploy` (preview deploy to Workers) and
  `node scripts/upload-r2.mjs` (upload the 667 PDFs to R2 — remote R2
  is still empty; the `file_key` values in D1 are exactly the keys the
  upload script produces).
- Real `TURNSTILE_SECRET_KEY` as a Worker secret
  (`wrangler secret put`) — local testing used a dummy secret in
  `.dev.vars`; live siteverify could not be proven in this sandbox
  (workerd outbound fetch to challenges.cloudflare.com fails here).
- DNS cutover approval (Phase 7) — needs the owner's explicit go-ahead.
  Do NOT cut over until the preview deploy + R2 upload are verified.

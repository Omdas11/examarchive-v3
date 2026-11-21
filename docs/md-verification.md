# MD Verification — spec (branch `md-verification`, not live)

Side-by-side verification of markdown against the official PDF, so AI
Notes grounding uses clean md. Built 2026-11-21. Do NOT deploy until
the user approves the migration apply + deploy (see "Still needed"
below).

## The two flows

### Flow 1 — Manual side-by-side verify
1. An item exists in the queue (`/admin/md-verification`), status
   `pending`, `in_review`, `needs_fix` or `approved`.
2. A verifier opens it. Large screens show the PDF on the left and the
   md on the right; phones stack them, PDF first.
3. The verifier switches the md pane between Edit (monospace textarea)
   and Preview (rendered markdown), fixes mistakes in place, and clicks
   Save draft (stores the edit in D1 with `edited_by` / `edited_at`) or
   Submit (same save, item marked `in_review`).
4. Approve marks `verified_by` / `verified_at`. That md becomes the
   source of truth for AI Notes. Needs fix sends it back with a note
   (note required).

## XP for completing a full md
- On Approve, the completer earns +25 XP and +5 AI credits, once per
  item — the same size as the moderator-accepted correction bonus, and
  like that bonus it bypasses the daily verify caps.
- Completer order: `edited_by`, else `submitted_by`, else `assigned_to`,
  else the approver. Self-approve earns the XP once (the founder tries
  the first item himself). If the completer has no users row, the award
  is skipped but the approval still stands.
- Guard: only on the transition into approved (status was not already
  approved) and only if `xp_awarded` is still 0. Re-approving pays
  nothing. No XP for Needs fix, Save draft, or Submit alone. The item
  status update and the users xp/ai_credits update run in one D1 batch.
  The review response returns `xp_awarded` / `xp_awarded_to`, and the
  detail view shows "+25 XP earned" after approval.
- Columns: `md_verification_items.xp_awarded` (INTEGER, default 0) and
  `xp_awarded_to` (TEXT), added by `migrations/0012_md_verification_xp.sql`.
5. Every save/review writes a row to `md_verification_history` with the
   previous md text, so the original is never lost. The PDF is never
   modified or deleted by this page.

### Flow 2 — AI upload, batch of 5, then verify
1. The founder creates an upload access code on the queue page
   (founder-only panel). The code is shown once.
2. The friend's IDE AI extracts md from one official PDF at a time and
   calls `POST /api/md-verification/upload` with the code in the
   `X-Upload-Code` header, multipart form: `paper_code`, `type`
   (`question` | `syllabus`), `batch_id`, `md` text (or `md_file`), and
   the `pdf` file. One item per call; a batch of 5 means 5 calls with
   the same `batch_id`.
3. The endpoint validates the code, paper code, sizes (PDF max 25 MB,
   md max 2 MB), and the token's daily cap, stores the PDF in R2 under
   `md-verification/<batch>/<item-id>.pdf` (private bucket, served only
   through the verifier-gated PDF route), stores the md in D1, and
   creates the item as `pending`. A duplicate paper in the same batch
   gets 409.
4. The friend (or a moderator) opens the item in Flow 1, compares it
   with the PDF, fixes minor mistakes, and submits / approves.

## Access
- Page + APIs: moderator, founder, or a user listed in `md_verifiers`.
  The friend is an assigned verifier, NOT a moderator — no role change.
- Founder-only, from the queue page: create / revoke upload codes,
  assign / unassign verifiers (by registered email or user id).
- The page is reached by direct link (`/admin/md-verification`); it is
  deliberately not in the sidebar, because sidebar entries are
  role-gated and assigned verifiers are usually students.

## Token lifecycle
- Create (founder): a 32-byte random code, shown once. Only its SHA-256
  hash is stored in `md_upload_tokens`. Defaults: 30-day expiry, 50
  uploads per token per UTC day.
- Use: header `X-Upload-Code`. Bad / expired / revoked code → 401.
  Over the daily cap → 429.
- Revoke (founder): sets `revoked_at`; the code stops working
  immediately and cannot be re-enabled. The hash row stays for audit.

## Files
- Page: `src/app/admin/md-verification/page.tsx`,
  `MdVerificationQueue.tsx`, `[id]/page.tsx`,
  `[id]/MdVerificationDetail.tsx`
- Logic: `src/lib/md-verification.ts` (pure, tested),
  `src/lib/md-verification-access.ts` (D1 gate + history)
- APIs: `src/app/api/md-verification/` — `route.ts` (list),
  `[id]/route.ts` (get / save), `[id]/review/route.ts`,
  `[id]/pdf/route.ts`, `upload/route.ts`, `tokens/route.ts`,
  `tokens/[tokenId]/route.ts`, `verifiers/route.ts`
- Migration (NOT applied): `migrations/0011_md_verification.sql`
  — `md_verification_items`, `md_verification_history`,
  `md_verifiers`, `md_upload_tokens`; indexes on status, paper_code,
  assigned_to, batch. `migrations/0012_md_verification_xp.sql`
  adds `xp_awarded` / `xp_awarded_to` to `md_verification_items`.
- Tests: `src/lib/md-verification.test.ts` (paper-code validation,
  SHA-256 token-hash vector, upload validation, paging, R2 key shape)

## Intentionally NOT built yet
- No auto-publish to the live paper page. Approving an item only marks
  it verified; wiring approved md into the live paper / AI Notes prompt
  is a separate step.
- No syllabus re-extraction. The 536 syllabus md files already exist;
  this page verifies them, it does not re-extract them.
- No bulk upload endpoint (one item per call by design), no verifier
  assignment per item from the UI (assign in D1 / a later step), no
  sidebar entry (see Access above).

## Still needed before anything goes live
1. User go-ahead to apply `migrations/0011_md_verification.sql` to
   production D1 (examarchive-db).
2. User go-ahead to deploy the `md-verification` branch.
3. Founder creates the first upload code and assigns the friend as a
   verifier, after the deploy.

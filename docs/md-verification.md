# MD Verification — spec (branch `migrate/cloudflare`, live)

Side-by-side verification of markdown against the official PDF, so AI
Notes grounding uses clean md. Built 2026-11-21, v2 same day,
upload flow + Verification Admin role in the follow-up the same day.

## The two flows

### Flow 1 — Manual side-by-side verify
1. An item exists in the queue (`/admin/md-verification`), status
   `pending`, `in_review`, `needs_fix` or `approved`.
2. A verifier opens it. Large screens show the PDF on the left and
   question cards on the right; phones stack them, PDF first.
3. Each card is one question: plain text box, marks box, PDF page
   box, and a "Looks right / Needs fix" toggle. No markdown knowledge
   needed. Saving reassembles the cards back into md in the same
   format, so the stored md never changes shape. The raw markdown
   editor sits behind "Raw text", founder only.
4. Hovering (or tapping) a card highlights its line in the PDF: the
   page is rendered with pdf.js and OCR'd in the browser, and the
   question's words are boxed. English only; Bengali / noisy scans
   fall back to showing the page with a note.
5. Save draft stores the edit in D1 with `edited_by` / `edited_at`;
   Submit does the same and marks the item `in_review`.
6. Approve marks `verified_by` / `verified_at`. That md becomes the
   source of truth for AI Notes. Needs fix sends it back with a note
   (note required). An already-approved item cannot be re-approved
   (409).
7. Every save/review writes a row to `md_verification_history` with
   the previous md text, so the original is never lost. The PDF is
   never modified or deleted by this page.

## Who can do what
- Page + APIs: moderator, founder, verification admin, or a user
  listed in `md_verifiers`.
- **Verification Admin** (role `verification_admin`, violet ring):
  opens MD Verification only — queue, detail, and the upload form.
  It cannot open `/admin/users`, `/admin/exam-timetable`, or any other
  admin page (every admin page gates on moderator), cannot change
  roles, assign verifiers, or manage upload codes, and gets no
  Vercel / Appwrite / Cloudflare access. It is a parallel track, not a
  promotion step: level 3 in `ROLE_LEVELS`, below every moderator gate.
- The four buttons (Save draft, Submit, Approve, Needs fix) belong to
  ONLY the verifier the item is assigned to. Moderators and the
  founder can view and suggest, but cannot act on an item assigned to
  someone else (or to nobody). An unassigned item becomes actionable
  when the founder assigns it from the detail page.
- Anyone with page access who is not the assignee sees a "Suggest an
  edit" form instead of the buttons: which question, corrected text,
  note. The assignee sees pending suggestions above the cards and can
  Apply (replaces that question's text) or Dismiss each one.
- Founder or moderator, from the queue page: email a 6-char upload
  code to a verifier (see Flow 2). Founder-only: assign / unassign
  verifiers (by registered email or user id).
- The page is in the sidebar (Admin section, "MD Verification") for
  moderators, the founder, and verification admins, and for assigned
  verifiers too: the sidebar entry is flagged `showForMdVerifier`,
  and `/api/profile` returns `is_md_verifier` from the `md_verifiers`
  table, so a student verifier sees the link while other students do
  not. It is also reachable by direct link (`/admin/md-verification`).

## Two admins at once
- Soft lock: opening the detail page claims a lock (heartbeat every
  30 s, 2-minute expiry by timestamp, no cron). The page shows "X is
  editing this now" when someone else holds it; the other person can
  still view and suggest. A lock never blocks a save by itself.
- Version check: a save carries the `updated_at` the page loaded with.
  If someone saved a newer version since, the server returns 409 with
  the current item and the page offers Reload instead of silently
  overwriting.

## How-to box
The detail page explains the buttons in plain words at the top: Save
draft keeps your work; Submit sends it for review; Approve marks the
text as the final source for AI Notes, gives +25 XP and +5 AI credits
to the person who finished it, and the item leaves the queue; Needs
fix sends it back with your note.

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

### Flow 2 — AI makes one zip, friend uploads it on the site, then verify
1. The friend's IDE AI extracts md from one official PDF at a time and
   packs each paper into ONE zip: the official PDF + its md file.
   (Setup prompt: `~/workspace/your_files/antigravity-verification-setup.md`.)
2. The founder or a moderator clicks "Send verification code" on the
   queue page and enters the verifier's email. The site emails them a
   6-character code (single-use, 24 hours). The email says to check
   spam and mark it as not spam if it lands there. Only the SHA-256
   hash is stored (`md_upload_codes`); the code itself is never
   returned by any API.
3. The friend signs in and opens `/admin/md-verification/upload`, picks
   the zip, paper code, type, batch id, and enters the emailed code.
   The server checks the signed-in account (founder, moderator,
   verification admin, or assigned verifier) AND the code: it must
   belong to that account's email, be unused, unexpired, and under 3
   wrong attempts. A wrong code counts an attempt; after 3 the code
   stops working and a new one must be sent.
4. The endpoint unzips in the Worker (fflate), requires exactly one PDF
   (max 25 MB) and one md file (max 2 MB), validates the paper code,
   stores the PDF in R2 under `md-verification/<batch>/<item-id>.pdf`
   (private bucket, served only through the verifier-gated PDF route),
   stores the md in D1, creates the item as `pending`, and marks the
   code used — item insert and code burn run in one D1 batch, so a code
   can never be reused. A duplicate paper in the same batch gets 409.
5. The friend (or a moderator) opens the item in Flow 1, compares it
   with the PDF, fixes minor mistakes, and submits / approves.

Email needs the `RESEND_API_KEY` Worker secret (Resend HTTP API,
`noreply@examarchive.dev`). When it is missing, sending fails with a
plain 503 and NO code is created — the admin sees what is missing
instead of stranding the verifier with a code that never arrives.

The old X-Upload-Code token system is gone: its only token was revoked
2026-11-21, `POST /api/md-verification/upload` no longer accepts a
header code, and the token routes (`/api/md-verification/tokens/*`)
were deleted. The `md_upload_tokens` table stays for history only.

## Access
- Page + APIs: moderator, founder, verification admin, or a user
  listed in `md_verifiers`.
- The four buttons belong to the assigned verifier only; everyone
  else suggests edits (see "Who can do what" above).
- Founder or moderator, from the queue page: email an upload code.
  Founder-only: assign / unassign verifiers (by registered email or
  user id). Per-item assignment is on the detail page (founder only).
- The page is in the sidebar (Admin section, "MD Verification") for
  moderators, the founder, and verification admins, and for assigned
  verifiers too: the sidebar entry is flagged `showForMdVerifier`,
  and `/api/profile` returns `is_md_verifier` from the `md_verifiers`
  table, so a student verifier sees the link while other students do
  not. It is also reachable by direct link (`/admin/md-verification`).

## MD format the cards expect
- Header lines, then `UNIT—I` … `UNIT—V` headings, then numbered
  questions with sub-parts (a) (b) (c). Marks as a trailing number
  ("... : 10"), a maths line ("$2+8=10$"), or a bare number line.
- The AI adds a `<!-- page N -->` marker before each question (the
  PDF page the question is on). The cards show it as the page box,
  and the line highlight uses it. Missing markers are fine — the
  verifier can set the page number on the card.
- Anything the parser cannot place is kept verbatim and re-emitted
  unchanged. Md with no numbered questions (e.g. syllabus md) shows
  the raw editor fallback instead of cards.

## Upload code lifecycle
- Send (founder / moderator): a 6-char code from an unambiguous
  alphabet (no 0/O/1/I/L), emailed to the verifier. Only its SHA-256
  hash is stored in `md_upload_codes`. Defaults: 24-hour expiry,
  single-use. Any previous unused code for that email is revoked
  first, so one live code exists per person.
- Use: the signed-in uploader enters the code on the upload form. The
  code must belong to that account's email. Wrong code → 401 and an
  attempt is counted; 3 wrong attempts kill the code. Used, expired,
  or revoked code → 401.
- No code is ever shown on screen or returned by any API — it travels
  only by email. If the email cannot be sent (no RESEND_API_KEY), no
  code is created at all.

## Files
- Page: `src/app/admin/md-verification/page.tsx`,
  `MdVerificationQueue.tsx`, `[id]/page.tsx`,
  `[id]/MdVerificationDetail.tsx`, `[id]/PdfLineViewer.tsx`,
  `upload/page.tsx`, `upload/MdVerificationUploadForm.tsx`
- Logic: `src/lib/md-verification.ts` (pure, tested — paper codes,
  upload codes, zip contents), `src/lib/md-verification-access.ts`
  (D1 gate + history), `src/lib/md-verification-parse.ts` (md ->
  question cards, pure, tested), `src/lib/md-verification-match.ts`
  (OCR word matcher, pure, tested),
  `src/lib/md-verification-permissions.ts` (assigned-only rule, pure,
  tested), `src/lib/resend-email.ts` (Resend HTTP API + code email)
- APIs: `src/app/api/md-verification/` — `route.ts` (list),
  `[id]/route.ts` (get / save, 409 version check),
  `[id]/review/route.ts` (409 when already approved),
  `[id]/pdf/route.ts`, `[id]/suggestions/route.ts` (list / create),
  `[id]/suggestions/[suggestionId]/route.ts` (apply / dismiss),
  `[id]/lock/route.ts` (soft lock), `[id]/assign/route.ts`
  (founder-only per-item assign), `upload/route.ts` (signed-in zip
  upload + emailed code), `upload-codes/route.ts` (founder /
  moderator: email a code), `verifiers/route.ts`
- Migration: `migrations/0011_md_verification.sql`
  — `md_verification_items`, `md_verification_history`,
  `md_verifiers`, `md_upload_tokens`; indexes on status, paper_code,
  assigned_to, batch. `migrations/0012_md_verification_xp.sql`
  adds `xp_awarded` / `xp_awarded_to` to `md_verification_items`.
  `migrations/0013_md_verification_suggestions_locks.sql` adds
  `md_verification_suggestions` and `md_verification_locks`.
  `migrations/0014_md_upload_codes.sql` adds `md_upload_codes`
  (emailed 6-char codes; `md_upload_tokens` kept for history only).
- Tests: `src/lib/md-verification.test.ts` (paper-code validation,
  SHA-256 token-hash vector, upload validation, paging, R2 key shape),
  `src/lib/md-verification-parse.test.ts` (round-trip on the real
  COMDSC-352T md, page markers, edits, header patch, messy md),
  `src/lib/md-verification-match.test.ts` (exact / noisy / no match),
  `src/lib/md-verification-permissions.test.ts` (assigned-only rule).
  Jest hangs in this VM (zero output, 20+ min) — verify the pure
  logic by transpiling the single file with the local tsc and running
  node assertions instead; do not block a deploy on a hung jest run.
- PDF worker: `public/pdf.worker.min.mjs` (copied from pdfjs-dist,
  no CDN worker URL). OCR runs in the browser via tesseract.js
  (English only; language data loads from CDN at runtime).

## Intentionally NOT built yet
- No auto-publish to the live paper page. Approving an item only marks
  it verified; wiring approved md into the live paper / AI Notes prompt
  is a separate step.
- No syllabus re-extraction. The 536 syllabus md files already exist;
  this page verifies them, it does not re-extract them.
- No bulk upload endpoint (one zip = one item, by design).
- No Bengali OCR for line highlight (tesseract.js English only);
  Bengali / noisy scans fall back to the page note.

## Applied with the follow-up deploy (2026-11-21)
- `migrations/0014_md_upload_codes.sql` applied to production D1
  (examarchive-db); the `md_upload_codes` table read back and verified
  in `sqlite_master`.
- Upload flow redesigned: X-Upload-Code tokens removed (routes
  deleted), replaced by the signed-in zip upload + emailed 6-char
  code. The friend's role changed from student to verification_admin
  (keeps his `md_verifiers` row).

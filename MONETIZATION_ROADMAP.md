# MONETIZATION_ROADMAP

## Objective

Implement a production-ready monetization and contribution economy for ExamArchive using the existing **Next.js + TypeScript + Appwrite** stack, without replacing current XP/Roles patterns.

This roadmap covers:
- Three-tier content model (AI, Peer Uploads, Admin Notes)
- Credits wallet + manual UPI verification MVP
- Semester Pass entitlements
- XP + role-driven incentives and moderation automation

---

## Guiding Principles

- Keep **Appwrite Databases** as the source of truth for entitlements, wallet balance, and audit logs.
- Keep **Appwrite Storage** as the only file layer for tiered note assets.
- Use **Appwrite Functions** for long-running/async AI generation and delayed processing.
- Make all value-changing actions (credit add/deduct/refund) **ledger-based** and idempotent.
- Preserve existing upload and moderation flows; extend instead of replacing.

---

## Phase 0 — Discovery, Policy Definition, and Contract Lock

### Goals
- Freeze economy rules before coding.
- Avoid schema churn in Appwrite by defining clear document contracts first.

### Appwrite Schema Changes (planning artifacts first)
- No production schema migration yet.
- Define final attribute contracts for the collections introduced in later phases:
  - `wallet_accounts`
  - `wallet_ledger`
  - `credit_purchase_requests`
  - `note_catalog`
  - `note_entitlements`
  - `ai_generation_jobs`
  - `semester_passes`
  - `role_economy_rules`
  - `moderation_queue` (or dedicated queues by domain)

### Appwrite Storage & Functions
- Define bucket strategy:
  - Existing paper/syllabus buckets remain unchanged.
  - Add dedicated bucket(s) for peer handwritten notes and premium typed notes.
- Define function responsibilities:
  - `ai-note-worker` (Gemini generation + status updates)
  - `wallet-reconciliation` (optional scheduled checks/stipends)

### Frontend UI Components
- None shipped yet; produce internal specs for:
  - Wallet dashboard
  - Tiered note detail/checkout states
  - UTR submission flow
  - Admin verification queues

### Potential Tech Debt / Edge Cases
- Scope creep risk if role perks and pricing are not frozen early.
- Mismatch risk between existing `users` document fields and new wallet/pass fields.
- Need explicit idempotency keys for all credit mutations.

---

## Phase 1 — Appwrite Data Model Foundation

### Goals
- Introduce schema primitives for monetization with complete auditability.

### Appwrite Schema Changes

#### 1) `wallet_accounts`
One document per user.
- `user_id` (string, required, unique index)
- `balance_credits` (integer, required, default 0)
- `lifetime_earned_credits` (integer, required, default 0)
- `lifetime_spent_credits` (integer, required, default 0)
- `lifetime_purchased_credits` (integer, required, default 0)
- `updated_at` (datetime, required)

#### 2) `wallet_ledger`
Immutable transaction log (append-only).
- `user_id` (string, required, index)
- `entry_type` (string: `earn|purchase|spend|refund|adjustment|stipend`, required)
- `amount_credits` (integer, required; positive for add, negative for spend)
- `balance_after` (integer, required)
- `source_type` (string: `upload_reward|utr_approved|tier_unlock|semester_pass_discount|admin_adjustment|system_stipend`, required)
- `source_ref_id` (string, required) — links to purchase request, note, upload, etc.
- `idempotency_key` (string, required, unique)
- `meta_json` (string/json, optional)
- `created_at` (datetime, required)

#### 3) `credit_purchase_requests`
Manual UPI verification queue.
- `user_id` (string, required, index)
- `utr` (string, required, unique candidate + normalized unique guard)
- `amount_inr` (integer, required)
- `credits_requested` (integer, required)
- `payment_screenshot_file_id` (string, optional)
- `status` (string: `submitted|under_review|approved|rejected|expired`, required)
- `reviewed_by` (string, optional)
- `reviewed_at` (datetime, optional)
- `rejection_reason` (string, optional)
- `created_at` (datetime, required)

#### 4) `note_catalog`
Unified listing for tiered note products.
- `note_type` (string: `ai_generated|peer_handwritten|admin_typed`, required)
- `title` (string, required)
- `paper_code` (string, required, index)
- `semester` (string/int, optional)
- `department` (string, optional)
- `uploader_user_id` (string, optional; peer only)
- `storage_bucket_id` (string, required)
- `storage_file_id` (string, required)
- `price_credits` (integer, required; Tier 1 may be 0 or low)
- `quality_status` (string: `pending|approved|rejected|flagged`, required)
- `is_published` (boolean, required)
- `created_by` (string, required)
- `created_at` (datetime, required)

#### 5) `note_entitlements`
Tracks who has access to which note.
- `user_id` (string, required, index)
- `note_id` (string, required, index)
- `access_type` (string: `purchase|semester_pass|admin_grant|free`, required)
- `valid_until` (datetime, optional)
- `source_ref_id` (string, required)
- `created_at` (datetime, required)
- Unique composite behavior required for (`user_id`, `note_id`) by application-level guard.

#### 6) `ai_generation_jobs`
Async worker state for Tier 1 AI generation.
- `user_id` (string, required, index)
- `paper_code` (string, required)
- `unit_number` (integer/string, required)
- `status` (string: `queued|running|completed|failed|cancelled`, required)
- `progress_percent` (integer, optional)
- `input_payload_json` (string/json, required)
- `result_file_id` (string, optional)
- `error_message` (string, optional)
- `started_at` (datetime, optional)
- `completed_at` (datetime, optional)
- `idempotency_key` (string, required, unique)
- `created_at` (datetime, required)

#### 7) `semester_passes`
- `user_id` (string, required, unique index)
- `status` (string: `active|expired|cancelled`, required)
- `plan_name` (string, required)
- `started_at` (datetime, required)
- `expires_at` (datetime, required)
- `usage_cap_type` (string: `unlimited|capped`, required)
- `usage_cap_value` (integer, optional)
- `usage_count` (integer, required, default 0)
- `discount_applied_percent` (integer, optional)

#### 8) `role_economy_rules`
Config collection to avoid hardcoding perks.
- `role_key` (string, required, unique)
- `upload_auto_approve` (boolean, required)
- `semester_pass_discount_percent` (integer, required, default 0)
- `monthly_credit_stipend` (integer, required, default 0)
- `tier2_discount_percent` (integer, required, default 0)
- `tier3_discount_percent` (integer, required, default 0)

#### 9) Moderation queue strategy
Either:
- A single `moderation_queue` with `queue_type` (`utr|peer_note|paper_upload`)  
or
- Reuse existing upload moderation + add dedicated `credit_purchase_requests` review flow.

### Appwrite Storage & Functions
- Add bucket: `peer-notes` (PDF/image uploads; strict size + mime allowlist).
- Add bucket: `admin-typed-notes` (premium assets only writable by admin role).
- Optional bucket: `payments-proof` (UTR screenshots).
- Define bucket permissions and max file size policies per tier.

### Frontend UI Components
- No full UI release yet; scaffold data contracts in frontend service layer:
  - Wallet read models
  - Entitlement checks
  - Purchase request DTOs

### Potential Tech Debt / Edge Cases
- Appwrite attribute type/size mismatches (already seen in existing sync status) can break writes.
- Unique constraints for UTR and idempotency keys must be enforced by both schema and app-level checks.
- Backfill strategy needed for users without `wallet_accounts`.

---

## Phase 2 — Tier 1 AI Notes as Async Product (Appwrite Function Worker)

### Goals
- Replace long blocking generation with queued async execution and reliable completion state.

### Appwrite Schema Changes
- Activate `ai_generation_jobs`.
- Add optional linkage in `Generated_Notes_Cache`/`note_catalog`:
  - `job_id`, `note_id`, `owner_user_id`, `tier`, `price_credits`.

### Appwrite Storage & Functions

#### Function: `ai-note-worker`
- Trigger pattern:
  - API route creates `ai_generation_jobs` document with `queued`.
  - Route triggers Appwrite Function execution with job ID.
- Worker steps:
  1. Lock job (`queued -> running`) with idempotent guard.
  2. Call Gemini generation.
  3. Persist content in DB and/or storage.
  4. Create/Update `note_catalog` item (Tier 1).
  5. Mark job `completed` + set `result_file_id`.
  6. On failure mark `failed` with structured reason.

#### Execution-limit planning
- Validate Appwrite Function timeout/memory limits for ~10 min tasks.
- If hard timeout risk remains, split into sub-jobs/chunked continuation:
  - `queued_part_n` pattern with checkpointing in `ai_generation_jobs`.
- Keep result durability independent of HTTP request lifecycle.

#### Notification planning
- Polling (MVP): frontend checks job status endpoint.
- Optional enhancement: Appwrite Realtime subscription for job completion events.

### Backend API Routes / Server Actions
- `POST /api/ai/jobs` — create job + optional credit pre-authorization.
- `GET /api/ai/jobs/:id` — status/progress/result.
- `POST /api/ai/jobs/:id/cancel` — best-effort cancellation.
- `GET /api/notes/:id/access` — entitlement gate.

### Frontend UI Components
- “Generate Notes” flow with async status card:
  - `Queued`, `Generating`, `Completed`, `Failed`.
- Job history panel in user dashboard.
- Completion CTA: “Open note” / “Download PDF”.

### Potential Tech Debt / Edge Cases
- Duplicate generation requests for same user+paper+unit (must idempotently collapse).
- Function retries causing double inserts without idempotency key handling.
- Orphan jobs (`running` but never completed) need watchdog/retry policy.

---

## Phase 3 — Tier 2 Peer Handwritten Notes Pipeline

### Goals
- Launch contribution-to-marketplace flow using Appwrite Storage + moderation controls.

### Appwrite Schema Changes
- Use `note_catalog` for published peer notes.
- Extend existing upload pipeline with monetization fields:
  - `proposed_price_credits`
  - `approval_status`
  - `quality_score`
  - `reward_credits_granted`
  - `reward_xp_granted`
- Queue linkage:
  - `queue_type = peer_note_approval`
  - reviewer metadata and timestamps

### Appwrite Storage & Functions
- Bucket: `peer-notes`
  - Allowed: PDF/images only
  - Max size policy per file
  - Private read; file access through authenticated Next.js proxy
- Optional function: antivirus/quality pre-check before moderation visibility.

### Backend API Routes / Server Actions
- `POST /api/peer-notes/upload-token` (if short-lived token pattern reused)
- `POST /api/peer-notes` — metadata save + queue entry
- `GET /api/peer-notes/mine` — uploader view
- `POST /api/admin/peer-notes/:id/approve`
- `POST /api/admin/peer-notes/:id/reject`

### Frontend UI Components
- Uploader wizard:
  - File upload
  - Metadata tagging
  - Pricing proposal
  - Submission confirmation
- “My Contributions” page with status and rewards.
- Admin moderation queue list + review modal.

### Potential Tech Debt / Edge Cases
- Large scan uploads and unstable networks.
- Duplicate/recycled content uploads.
- Abuse/spam uploads for farming credits/XP.
- Need clear rejection reasons and re-upload flow.

---

## Phase 4 — Tier 3 Admin Typed Notes Catalog

### Goals
- Introduce premium highest-quality inventory with deterministic pricing.

### Appwrite Schema Changes
- Reuse `note_catalog` with `note_type=admin_typed`.
- Add optional premium metadata:
  - `version`
  - `reviewed_by_admin_id`
  - `curriculum_tag`
  - `is_featured`

### Appwrite Storage & Functions
- Bucket: `admin-typed-notes` writable only by admin/moderator.
- Optional publish function:
  - validates metadata completeness
  - flips `is_published=true`

### Backend API Routes / Server Actions
- `POST /api/admin/typed-notes`
- `PATCH /api/admin/typed-notes/:id`
- `POST /api/admin/typed-notes/:id/publish`
- `GET /api/notes/catalog` (filter by tier, course, semester, price)

### Frontend UI Components
- Admin note creation/edit form.
- Public premium catalog cards (locked/unlocked states).
- Note detail page showing tier badge, price, and entitlement state.

### Potential Tech Debt / Edge Cases
- Price migrations and grandfathering old purchases.
- Versioning policy for major note updates.

---

## Phase 5 — Wallet + Manual UPI (UTR) MVP

### Goals
- Enable users to buy credits via manual verification without integrating payment gateway yet.

### Appwrite Schema Changes
- Activate `wallet_accounts`, `wallet_ledger`, `credit_purchase_requests`.
- Optional field on existing `users` docs for quick display:
  - `wallet_balance_cached` (derived, not authoritative).

### Appwrite Storage & Functions
- Optional `payments-proof` bucket for screenshot evidence.
- Scheduled function (optional) to expire stale pending UTR requests.

### Backend API Routes / Server Actions
- User flows:
  - `GET /api/wallet`
  - `GET /api/wallet/ledger`
  - `POST /api/wallet/utr-submit`
- Admin/mod flows:
  - `GET /api/admin/wallet/utr-queue`
  - `POST /api/admin/wallet/utr/:id/approve`
  - `POST /api/admin/wallet/utr/:id/reject`

### Crediting logic on approval
1. Validate request still `submitted/under_review`.
2. Acquire idempotency key (`utr:{utr}:approve`).
3. Create ledger credit entry.
4. Atomically update `wallet_accounts.balance_credits`.
5. Mark request `approved` + reviewer details.
6. Log action in `activity_logs`.

### Frontend UI Components
- Wallet dashboard:
  - Balance
  - Packages (INR -> credits)
  - Ledger history
- UPI payment page:
  - QR instructions
  - UTR submission form
  - Pending/review status
- Admin UTR queue:
  - Search/filter
  - Approve/reject modal with reason

### Potential Tech Debt / Edge Cases
- Duplicate UTR submission across users.
- Ambiguous bank references or delayed settlements.
- Manual ops burden as transaction volume grows.
- Fraud risk without screenshot+amount+timestamp checks.

---

## Phase 6 — Semester Pass Entitlements

### Goals
- Add 6-month access plan (unlimited or capped model) integrated with tiers.

### Appwrite Schema Changes
- Activate `semester_passes`.
- Optional link in `note_entitlements` for pass-driven accesses.

### Appwrite Storage & Functions
- Optional scheduled function:
  - nightly pass expiry checks
  - usage cap resets (if policy requires monthly reset)

### Backend API Routes / Server Actions
- `POST /api/pass/purchase-request` (manual MVP or admin grant)
- `GET /api/pass/status`
- `POST /api/admin/pass/:userId/activate`
- `POST /api/admin/pass/:userId/cancel`

### Access decision order (runtime guard)
1. If user has active pass and tier is included -> allow access.
2. Else if user has per-note entitlement -> allow.
3. Else require credit purchase.

### Frontend UI Components
- Semester pass purchase CTA and plan card.
- Pass badge in user profile/dashboard.
- Usage meter (for capped mode).

### Potential Tech Debt / Edge Cases
- Mid-cycle role/perk changes affecting discount consistency.
- Prevent double-charging when pass already grants access.

---

## Phase 7 — XP/Roles Economy Integration

### Goals
- Make contribution incentives and role perks first-class and configurable.

### Appwrite Schema Changes
- Activate `role_economy_rules`.
- Ensure existing `users` profile supports:
  - `xp_total`
  - `role_key`
  - any existing upload counters used for rewards

### Earning Logic (upload approval path)
On approved valid handwritten note/paper:
1. Award XP using current XP service.
2. Award credits via wallet ledger (`source_type=upload_reward`).
3. Record both in activity logs/audit metadata.
4. Prevent double rewards via idempotency key per approved upload.

### Role-Based Perk Logic
- Auto-approval bypass:
  - If `role_economy_rules.upload_auto_approve=true`, skip manual queue.
- Discounts:
  - Apply role discount for semester pass and/or note tiers at checkout.
- Monthly stipend:
  - Scheduled function credits eligible users monthly and writes ledger entries.

### Backend API Routes / Server Actions
- `GET /api/economy/role-perks`
- `POST /api/admin/economy/role-rules`
- Integrate reward execution into existing moderation approval endpoints.

### Frontend UI Components
- Role perks panel in profile.
- Admin role-economy settings screen.
- Checkout price breakdown (base, discount, final credits).

### Potential Tech Debt / Edge Cases
- Race conditions when role changes during checkout.
- Stipend duplication if scheduler reruns without idempotency.
- Need transparent user-visible reward policy to reduce disputes.

---

## Phase 8 — Admin & Moderator Operations Console

### Goals
- Consolidate operational queues and actions for scalability.

### Appwrite Schema Changes
- Ensure consistent status enums/timestamps across:
  - upload moderation
  - UTR verification
  - AI job incident queue (failed jobs)

### Appwrite Storage & Functions
- Optional function for queue analytics snapshots (pending counts, SLA breaches).

### Backend API Routes / Server Actions
- Unified admin endpoints for:
  - `utr queue`
  - `peer note approval queue`
  - `failed ai jobs`
  - `audit logs`

### Frontend UI Components
- Admin dashboard tabs:
  - Transactions Queue
  - Note Approval Queue
  - AI Failures Queue
  - Audit Trail
- Bulk actions for low-risk operations.

### Potential Tech Debt / Edge Cases
- Permission leakage risk (strict role checks mandatory).
- Need pagination/indexes for high-volume queues.

---

## Phase 9 — Security, Abuse Prevention, and Observability

### Goals
- Harden money-like and entitlement-like flows before broad rollout.

### Security Controls
- Idempotency keys for every credit mutation.
- Strict server-side entitlement checks on all protected note fetch routes.
- Role-based authorization for admin/mod endpoints.
- Rate limits on UTR submissions and upload attempts.
- Validate file mime/type/size both client and server.

### Observability
- Extend `activity_logs` coverage to:
  - credit approvals/rejections
  - reward grants
  - entitlement grants/revocations
  - admin override actions
- Add monitoring queries for:
  - failed function runs
  - stuck generation jobs
  - unusual wallet activity patterns

### Potential Tech Debt / Edge Cases
- Credit balance drift if ledger and account balance become inconsistent.
- Need periodic reconciliation job (`sum(ledger) == account balance`).

---

## Phase 10 — Rollout Plan (Controlled Release)

### Step-by-step release order
1. Ship schema + internal admin-only wallet APIs.
2. Enable UTR flow for a small test cohort.
3. Enable Tier 2 uploads with strict moderation.
4. Enable Tier 1 async AI worker with job polling.
5. Enable Tier 3 premium catalog.
6. Enable Semester Pass.
7. Enable role perks (auto-approval, discounts, stipend) in stages.

### Rollback Strategy
- Feature flags by capability:
  - `wallet_enabled`
  - `utr_enabled`
  - `tier2_marketplace_enabled`
  - `tier3_premium_enabled`
  - `semester_pass_enabled`
  - `role_perks_enabled`
- On incident:
  - disable purchase/checkout endpoints
  - keep read-only wallet + existing entitlements available
  - freeze new ledger writes except admin adjustments

---

## API and Component Checklist (Consolidated)

### Backend (Next.js API / Server Actions)
- Wallet: balance, ledger, UTR submit
- Admin wallet: queue list, approve, reject
- Notes catalog: list/detail/access check/purchase
- AI jobs: create/status/cancel
- Admin notes: create/edit/publish
- Pass: status/activate/cancel
- Role economy: perks read/config update

### Frontend
- Wallet Dashboard
- UTR Submission Form + History
- Tiered Note Catalog + Note Detail
- Purchase Confirmation Modal
- Semester Pass Plan Card + Usage Meter
- Contribution Upload Wizard (Tier 2)
- My Contributions Screen
- Admin Queues (UTR + Upload Approvals + AI Failures)
- Role Perks Panel

---

## Key Edge Cases to Explicitly Test

- Duplicate UTR submitted by same/different users.
- Admin approves same UTR request twice (idempotency expected).
- Credit deduction and entitlement creation partial failure (must be atomic or compensating).
- AI worker timeout/retry causing duplicate note creation.
- Upload approved twice causing duplicate XP/credits.
- Role changes between cart view and checkout.
- Semester pass expires mid-session.
- Storage file deleted but DB metadata still published.

---

## Suggested Appwrite Collection Permission Model (High-level)

- `wallet_accounts`: user read own; admin/mod read all; writes server-only.
- `wallet_ledger`: user read own; admin/mod read all; writes server-only.
- `credit_purchase_requests`: user create/read own; admin/mod review; writes server-only for status transitions.
- `note_catalog`: public-to-authenticated read for published items; write admin/mod except uploader intake route.
- `note_entitlements`: user read own; write server-only.
- `ai_generation_jobs`: user read own jobs; write server-only.
- `semester_passes`: user read own; write server-only/admin.
- `role_economy_rules`: read authenticated; write admin only.

---

## Final Delivery Criteria

Monetization roadmap is complete when:
- All collections/attributes and indexes are defined and created in Appwrite.
- Tier 1 async generation reliably completes via Appwrite Functions.
- Tier 2 and Tier 3 note commerce is entitlement-gated.
- Wallet ledger is immutable and balances reconcile.
- UTR manual verification queue is operational for admins.
- Semester pass access rules work with tiered catalog.
- XP + credits reward path is idempotent and role-perk aware.

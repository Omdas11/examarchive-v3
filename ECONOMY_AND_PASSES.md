# Economy & Passes — ExamArchive Token Economy

> **Status 2026-11-12: the Store is Coming Soon — nothing below is purchasable.** `STORE_COMING_SOON = true` in `src/lib/economy.ts` makes `/store` return "Coming Soon" before any data fetching, and credit balances are hidden. The token economy keeps running (verify-to-earn XP), but no packs, passes, or claims can be bought or claimed right now. This doc describes the designed economy, not a live shop.

## Overview

ExamArchive uses a virtual currency called **tokens** (shown with an `e` coin icon) to gate AI-generated PDF
creation. This document describes the full economy model, pricing, passes, daily-claim
mechanics, and the Appwrite schema changes required to support passes and badges.

---

## 1. Currency: tokens (`e`)

| Constant | Value | Location |
|---|---|---|
| `GENERATION_COST_CREDITS` | 10 | `src/lib/economy.ts` |
| `DEFAULT_CREDITS` (signup) | 100 | `src/lib/economy.ts` |
| `FREE_WEEKLY_CLAIM_CREDITS` | 0 | `src/lib/payments.ts` |

### Cost per PDF

Every AI-generated PDF deducts **10 tokens** from the user's balance. With a ₹50 pack
(100 tokens) that equals **₹5.00 per PDF**.

---

## 2. Credit Packs (one-time top-ups)

| Pack | Tokens | Price | Cost/PDF |
|---|---|---|---|
| Pack 1 | 10 | ₹8 | ₹8.00 |
| Pack 2 | 25 | ₹18 | ₹7.20 |
| Pack 3 | 50 | ₹30 | ₹6.00 |
| Pack 4 | 100 | ₹50 | ₹5.00 |
| Pack 5 | 250 | ₹100 | ₹4.00 |

The packs are defined in `src/lib/payments.ts` as `CREDIT_PACKS` (cost per PDF at 10 tokens per PDF).

### Free Weekly Claim

> **Designed, never built.** The weekly claim was designed as 10 tokens/week, but no `POST /api/payments/claim-weekly` route exists, and the amount in code is 0 (`FREE_WEEKLY_CLAIM_CREDITS = 0` in `src/lib/payments.ts`). There is nothing to claim.

New users start with 100 tokens. The `last_weekly_claim_at` attribute exists in the `users` collection schema, but without a claim route it is unused.

---

## 3. Passes & Subscriptions

Passes are defined in `src/lib/payments.ts` as `PASSES`.

### 3.1 Weekly Pass

| | One-time | Subscribed |
|---|---|---|
| Price | ₹49 | ₹39/week |
| Allowance | 10e/day for 7 days | 10e/day (auto-renews) |
| Total credits | 70e | 70e/cycle |

### 3.2 Monthly Pass

| | One-time | Subscribed |
|---|---|---|
| Price | ₹199 | ₹179/month |
| Allowance | 20e/day for 30 days | 20e/day (auto-renews) |
| Total credits | 600e | 600e/cycle |

### 3.3 Be a Supporter

| | Subscribed only |
|---|---|
| Price | ₹49/month |
| Monthly claim | **Claim 100e every month** (must be claimed manually — not auto-deposited) |
| Badge | Exclusive **Supporter Badge** |

> **Claim it or lose it**: The 100e monthly allowance is not automatically deposited.
> The subscriber must click "Claim" once per billing cycle. If not claimed before the
> cycle renews, those credits are forfeited and the counter resets.

---

## 4. Daily Claim Mechanics — "Claim It or Lose It"

> **Important rule:** All pass-based credit allowances (daily credits for Weekly/Monthly
> Pass, and the monthly 100e for Supporter) are **not automatically deposited**. The user
> must actively click "Claim" each day (or each billing cycle for Supporter). Any unclaimed
> credits from a given day/cycle are **permanently forfeited** — they do not carry over.

When a user has an active pass, a daily background job (Appwrite Scheduled Function)
or a manual claim button (`POST /api/payments/claim-daily` — **not implemented; no route file exists**) should:

1. Check if the user has an active `user_passes` document that hasn't expired.
2. Check if `last_daily_claim_at` is before today's midnight (UTC).
3. Credit `dailyCredits` to `users.ai_credits` (atomic increment).
4. Update `last_daily_claim_at` to now.
5. Decrement `days_remaining` in `user_passes`; set `status = expired` when it
   reaches 0.

---

## 5. Badges & Achievements

Badge component files live in `src/components/badges/AchievementBadges.tsx`.

| Badge ID | Component | Trigger |
|---|---|---|
| `supporter_badge` | `<SupporterBadge />` | Supporter tier active |
| `first_pdf_badge` | `<FirstPdfBadge />` | First PDF successfully generated |

### Displaying the Supporter Badge

> **Not displayed anywhere reachable.** `<SupporterBadge />` is rendered only inside `StoreClient.tsx` (unreachable while the store is Coming Soon), and `<FirstPdfBadge />` is never rendered outside its definition file. The Header does not render badges, and `GET /api/profile` returns `ai_credits` but no badges field. Badge components are defined in `src/components/badges/AchievementBadges.tsx`; wiring them into the Header/Profile is still to do.

---

## 6. Appwrite Schema Changes Required

> **Auto-synced:** All schema changes below are now included in
> `scripts/v2/sync-appwrite-schema.js`. Run `npm run appwrite:sync` to automatically
> create or update all collections and attributes in your Appwrite project. No manual
> collection creation is needed.

### 6.1 `users` collection (extend existing)

| Attribute | Type | Description |
|---|---|---|
| `last_weekly_claim_at` | datetime (nullable) | Timestamp of last free weekly claim |
| `badges` | string[] | Array of badge IDs the user has earned |

### 6.2 New collection: `user_passes`

| Attribute | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | yes | Appwrite user ID (index) |
| `pass_id` | string | yes | `weekly_pass` / `monthly_pass` / `supporter` |
| `mode` | string | yes | `onetime` or `subscribe` |
| `status` | string | yes | `active` / `expired` / `cancelled` |
| `daily_credits` | integer | yes | Credits credited per day |
| `days_remaining` | integer | yes | Days left on this pass |
| `last_daily_claim_at` | datetime | no | Last daily claim timestamp |
| `activated_at` | datetime | yes | When pass was activated |
| `expires_at` | datetime | yes | When pass expires |
| `razorpay_subscription_id` | string | no | Razorpay subscription ID (subscribed mode) |
| `razorpay_order_id` | string | no | Razorpay one-time order ID |

### 6.3 New collection: `user_badges`

| Attribute | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | yes | Appwrite user ID (index) |
| `badge_id` | string | yes | Badge identifier |
| `awarded_at` | datetime | yes | When badge was earned |
| `source` | string | no | What triggered the badge |

---

## 7. API Route Scaffold

| Route | Method | Status | Description |
|---|---|---|---|
| `/api/payments/claim-weekly` | POST | ❌ Not implemented — no route file | Claim free tokens (weekly reset); amount in code is 0 |
| `/api/payments/razorpay/create-pass-order` | POST | ❌ Not implemented — no route file | Create Razorpay order for pass |
| `/api/payments/razorpay/verify-pass` | POST | ❌ Not implemented — no route file | Verify pass payment + activate |
| `/api/payments/claim-daily` | POST | ❌ Not implemented — no route file | Claim daily tokens from active pass |

Only `/api/payments/razorpay/create-order` and `/api/payments/razorpay/verify` exist. Note: `StoreClient.tsx` already fetches `create-pass-order` / `verify-pass` — those are dead endpoints until the routes are built.

---

## 8. Subscription Pipeline Setup (Razorpay)

To enable the **Subscribe** buttons on Weekly Pass, Monthly Pass, and Supporter tier,
the following one-time Razorpay setup is required:

### 8.1 Razorpay Dashboard Steps

1. **Enable Subscriptions** — Go to Razorpay Dashboard → Settings → Products → enable
   *Subscriptions*.
2. **Create Subscription Plans** — Under Subscriptions → Plans, create one plan per tier:
   - `weekly_pass_plan` — ₹39 / week, `interval: 1`, `period: weekly`
   - `monthly_pass_plan` — ₹179 / month, `interval: 1`, `period: monthly`
   - `supporter_plan` — ₹49 / month, `interval: 1`, `period: monthly`
   Record each `plan_id` (format: `plan_XXXXX`) — these go in your environment variables.
3. **Register Webhook** — Subscriptions → Settings → Webhooks → add your production URL:
   ```
   https://examarchive.dev/api/payments/razorpay/webhook
   ```
   > **Route not implemented:** no webhook route exists under `src/app/api/payments/` yet.
   Enable the events: `subscription.activated`, `subscription.charged`,
   `subscription.cancelled`, `subscription.completed`.
   Copy the **Webhook Secret** to your env as `RAZORPAY_WEBHOOK_SECRET`.

### 8.2 New Environment Variables Required

```env
# Razorpay Plan IDs (from Razorpay Dashboard → Subscriptions → Plans)
RAZORPAY_PLAN_ID_WEEKLY_PASS=plan_XXXXXXXXXXXXXXXX
RAZORPAY_PLAN_ID_MONTHLY_PASS=plan_XXXXXXXXXXXXXXXX
RAZORPAY_PLAN_ID_SUPPORTER=plan_XXXXXXXXXXXXXXXX

# Webhook verification
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

Add these to Vercel → Project → Settings → Environment Variables.

### 8.3 Backend Routes to Implement

> **None of these routes exist yet** — see §7.

| Route | Trigger | Action |
|---|---|---|
| `POST /api/payments/razorpay/create-pass-order` | User clicks Subscribe | Create Razorpay Subscription using plan ID, return `subscription_id` + `key_id` to frontend |
| `POST /api/payments/razorpay/webhook` | Razorpay sends event | Verify HMAC signature, handle `subscription.activated` (create `user_passes` doc + award badge), `subscription.charged` (reset monthly claim), `subscription.cancelled` (set status=cancelled) |
| `POST /api/payments/claim-daily` | User clicks daily Claim | Check `user_passes` active + today not yet claimed → add credits + update `last_daily_claim_at` |

> **No Razorpay subscription API calls are needed from the client.** All subscription
> lifecycle events come through the webhook. The frontend only needs to open the
> Razorpay Checkout in subscription mode using the `subscription_id` returned by
> `create-pass-order`.

---

## 8. Frontend Asset Map

| Asset | Path | Usage |
|---|---|---|
| Credit currency icon | `src/components/CreditIcon.tsx` | Header balance pill, Store packs |
| Supporter badge SVG | `src/components/badges/AchievementBadges.tsx` | Store supporter card, Profile |
| First-PDF badge SVG | `src/components/badges/AchievementBadges.tsx` | Profile achievements |

---

*Last updated: 2026-11-12 — Store Coming Soon banner added; pack prices, constant names, weekly claim (0, never built), dead routes, badge display, and webhook domain corrected. Previous version: 2026-04.*

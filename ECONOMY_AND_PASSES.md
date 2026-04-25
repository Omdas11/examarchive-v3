# Economy & Passes — ExamArchive Electron Economy

## Overview

ExamArchive uses a virtual currency called **Electrons** (`e`) to gate AI-generated PDF
creation. This document describes the full economy model, pricing, passes, daily-claim
mechanics, and the Appwrite schema changes required to support passes and badges.

---

## 1. Currency: Electrons (`e`)

| Constant | Value | Location |
|---|---|---|
| `GENERATION_COST_ELECTRONS` | 10 | `src/lib/economy.ts` |
| `DEFAULT_ELECTRONS` (signup) | 100 | `src/lib/economy.ts` |
| `FREE_WEEKLY_CLAIM_ELECTRONS` | 10 | `src/lib/payments.ts` |

### Cost per PDF

Every AI-generated PDF deducts **10e** from the user's balance. With a ₹59 pack
(100e) that equals **₹5.90 per PDF**.

---

## 2. Credit Packs (one-time top-ups)

| Pack | Electrons | Price | Cost/PDF |
|---|---|---|---|
| Free Weekly Claim | 10e | ₹0 | — |
| Pack 1 | 20e | ₹19 | ₹9.50 |
| Pack 2 | 50e | ₹39 | ₹7.80 |
| Pack 3 | 100e | ₹59 | ₹5.90 |

The packs are defined in `src/lib/payments.ts` as `CREDIT_PACKS`.

### Free Weekly Claim

New users start with 100e. Any user can claim an additional **10e per week** (resets
every Monday) at zero cost via `POST /api/payments/claim-weekly`.

**Backend requirements (to be implemented):**

- Add `last_weekly_claim_at` (datetime) attribute to the `users` Appwrite collection.
- In the claim route: check if `last_weekly_claim_at` is older than 7 days (or null);
  if so, add 10e and update the timestamp; otherwise return an error with the next
  reset time.

---

## 3. Passes & Subscriptions

Passes are defined in `src/lib/payments.ts` as `PASSES`.

### 3.1 Weekly Pass

| | One-time | Subscribed |
|---|---|---|
| Price | ₹49 | ₹39/week |
| Allowance | 10e/day for 7 days | 10e/day (auto-renews) |
| Total electrons | 70e | 70e/cycle |

### 3.2 Monthly Pass

| | One-time | Subscribed |
|---|---|---|
| Price | ₹199 | ₹179/month |
| Allowance | 20e/day for 30 days | 20e/day (auto-renews) |
| Total electrons | 600e | 600e/cycle |

### 3.3 Be a Supporter

| | Subscribed only |
|---|---|
| Price | ₹49/month |
| Monthly claim | **Claim 100e every month** (must be claimed manually — not auto-deposited) |
| Badge | Exclusive **Supporter Badge** |

> **Claim it or lose it**: The 100e monthly allowance is not automatically deposited.
> The subscriber must click "Claim" once per billing cycle. If not claimed before the
> cycle renews, those electrons are forfeited and the counter resets.

---

## 4. Daily Claim Mechanics — "Claim It or Lose It"

> **Important rule:** All pass-based electron allowances (daily electrons for Weekly/Monthly
> Pass, and the monthly 100e for Supporter) are **not automatically deposited**. The user
> must actively click "Claim" each day (or each billing cycle for Supporter). Any unclaimed
> electrons from a given day/cycle are **permanently forfeited** — they do not carry over.

When a user has an active pass, a daily background job (Appwrite Scheduled Function)
or a manual claim button (`POST /api/payments/claim-daily`) should:

1. Check if the user has an active `user_passes` document that hasn't expired.
2. Check if `last_daily_claim_at` is before today's midnight (UTC).
3. Credit `dailyElectrons` to `users.ai_credits` (atomic increment).
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

The badge is shown in:

- **Header** (`src/components/layout/Header.tsx`) — fetch badge list from
  `GET /api/profile` alongside `ai_credits` and render `<SupporterBadge />` next
  to the electron balance pill.
- **Profile page / dropdown** — same fetch.

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
| `daily_electrons` | integer | yes | Electrons credited per day |
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
| `/api/payments/claim-weekly` | POST | 🚧 Scaffold | Claim free 10e (weekly reset) |
| `/api/payments/razorpay/create-pass-order` | POST | 🚧 Scaffold | Create Razorpay order for pass |
| `/api/payments/razorpay/verify-pass` | POST | 🚧 Scaffold | Verify pass payment + activate |
| `/api/payments/claim-daily` | POST | 🚧 Scaffold | Claim daily electrons from active pass |

Routes marked 🚧 require the Appwrite schema changes above before full implementation.

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
   https://examarchive.vercel.app/api/payments/razorpay/webhook
   ```
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

| Route | Trigger | Action |
|---|---|---|
| `POST /api/payments/razorpay/create-pass-order` | User clicks Subscribe | Create Razorpay Subscription using plan ID, return `subscription_id` + `key_id` to frontend |
| `POST /api/payments/razorpay/webhook` | Razorpay sends event | Verify HMAC signature, handle `subscription.activated` (create `user_passes` doc + award badge), `subscription.charged` (reset monthly claim), `subscription.cancelled` (set status=cancelled) |
| `POST /api/payments/claim-daily` | User clicks daily Claim | Check `user_passes` active + today not yet claimed → add electrons + update `last_daily_claim_at` |

> **No Razorpay subscription API calls are needed from the client.** All subscription
> lifecycle events come through the webhook. The frontend only needs to open the
> Razorpay Checkout in subscription mode using the `subscription_id` returned by
> `create-pass-order`.

---

## 8. Frontend Asset Map

| Asset | Path | Usage |
|---|---|---|
| Electron currency icon | `src/components/ElectronIcon.tsx` | Header balance pill, Store packs |
| Supporter badge SVG | `src/components/badges/AchievementBadges.tsx` | Store supporter card, Profile |
| First-PDF badge SVG | `src/components/badges/AchievementBadges.tsx` | Profile achievements |

---

*Last updated: 2026-04 — Electron Economy v2 soft-launch revision.*

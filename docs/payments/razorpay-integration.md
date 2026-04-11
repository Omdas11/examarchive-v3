# Razorpay Integration Architecture

This document defines the payment architecture that replaces quota-based monetization with purchase-backed access in Next.js + Appwrite.

## Goals

- Verify Razorpay payment signatures server-side.
- Persist purchase truth in Appwrite (`Purchases` collection).
- Use purchases to authorize premium generation flows.
- Keep client-side payment code free of trusted verification logic.

## Next.js API Route Architecture

## 1) Create order route

- **Route:** `POST /api/payments/razorpay/create-order`
- **Responsibility:**
  - Authenticate user (`getServerUser`).
  - Validate product/plan input and amount from trusted server config (never trust client amount).
  - Create Razorpay order through server-side SDK credentials.
  - Return `order_id`, amount, currency, and plan metadata required by checkout UI.

## 2) Verify signature route

- **Route:** `POST /api/payments/razorpay/verify`
- **Responsibility:**
  - Authenticate user.
  - Accept `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
  - Reconstruct the expected signature from `order_id|payment_id` using server secret.
  - Compare signatures using timing-safe comparison.
  - On success, upsert purchase row in Appwrite.
  - Return normalized purchase status to UI.

## 3) Optional webhook route (recommended)

- **Route:** `POST /api/payments/razorpay/webhook`
- **Responsibility:**
  - Validate Razorpay webhook signature with webhook secret.
  - Handle authoritative async events (captured, failed, refunded, chargeback, etc.).
  - Reconcile `Purchases` status changes idempotently.
  - Keep verification route fast while webhooks remain source-of-truth for late state updates.

## Appwrite Collection Schema: `Purchases`

Recommended collection ID: `Purchases`

| Field | Type | Required | Notes |
|---|---|---|---|
| `user_id` | String | Yes | Appwrite user ID |
| `email` | String | No | Snapshot email at purchase time |
| `provider` | String | Yes | Always `razorpay` |
| `order_id` | String | Yes | Razorpay order ID |
| `payment_id` | String | No | Razorpay payment ID (set after payment success) |
| `signature` | String | No | Optional stored signature hash/audit field |
| `status` | String | Yes | `created` \| `captured` \| `failed` \| `refunded` \| `disputed` |
| `product_code` | String | Yes | Internal SKU/plan code |
| `amount` | Integer | Yes | Amount in paise |
| `currency` | String | Yes | Typically `INR` |
| `credits_granted` | Integer | No | Credits added for this purchase |
| `entitlement_type` | String | No | e.g. `notes_pack`, `monthly_subscription` |
| `entitlement_expires_at` | Datetime | No | For time-boxed plans |
| `metadata_tags` | String[] | No | Example: `payment:razorpay`, `monetization:v2` |
| `raw_payload` | String | No | Sanitized provider payload/audit trail |
| `verified_at` | Datetime | No | Timestamp of server verification |

## Index recommendations

- Unique index on `payment_id` (when present).
- Unique index on `order_id` (or `order_id + user_id`).
- Index on `user_id, status`.
- Index on `$createdAt`.

## Access control model

- Write operations: server-side only (admin API key).
- Read operations:
  - Server routes: full read/write.
  - User dashboard: filtered by authenticated `user_id` through trusted API route.
- Never expose Razorpay `key_secret`, webhook secret, or signature verification logic to client components.

## Replacing quota checks

- Existing quota checks should become entitlement checks:
  - Resolve active purchase/subscription for `user_id`.
  - Derive generation allowance from purchase entitlements.
  - Reject requests when no active entitlement exists.
- `user_quotas` can remain for temporary compatibility, but final gating should use `Purchases` as source of truth.

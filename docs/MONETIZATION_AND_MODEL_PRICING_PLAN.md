# MONETIZATION_AND_MODEL_PRICING_PLAN.md

Build a sustainable, student-safe monetization system without requiring an immediate payment
gateway, while providing a clear path to full revenue automation.

---

## Current AI Bottleneck

| Parameter         | Value                                     |
|-------------------|-------------------------------------------|
| Current model     | Gemini 2.0 Flash Lite (experimental)      |
| Free RPD limit    | 500 requests/day                          |
| Primary risk      | Queue exhaustion during peak student usage|

This bottleneck must be resolved by launch via queue management and tiered access rules.
See `AI_MODEL_EXPANSION_PLAN.md` for multi-model routing strategy.

---

## Revenue Strategy (Phase-wise)

### Phase A — Internal Coin Economy (No gateway)

Users earn and spend ExamCoins — a virtual in-app currency:

**Earn coins by:**
- Uploading a verified question paper: **+15 coins**
- Fixing metadata on an existing entry: **+5 coins**
- Completing daily visit streak (7-day): **+10 coins**
- Referring a new registered student: **+20 coins**
- Approved syllabus correction: **+8 coins**

**Spend coins on:**
- AI-generated basic notes PDF (fast): **8–15 coins**
- AI-generated structured summary PDF: **20–35 coins**
- AI-generated deep explanation PDF (premium): **40–75 coins**
- AI-generated solved paper PDF: **25–50 coins**

### Phase B — Manual Recharge (Interim)

- Student sends UPI payment + screenshot
- Admin manually credits coins via admin panel
- Transaction logged in audit ledger
- No automation; ops-heavy but functional for launch window

**Coin pack pricing (suggested INR):**

| Pack           | Coins  | INR Price | Notes                     |
|----------------|--------|-----------|---------------------------|
| Starter        | 100    | ₹19       | For first-time recharge   |
| Standard       | 350    | ₹49       | Most popular               |
| Pro            | 1000   | ₹119      | Power users / heavy use    |

### Phase C — Automated Payments (Post-launch)

- Integrate Razorpay or Cashfree once volume stabilizes
- INR → coins conversion handled automatically
- Webhook confirms payment → coins credited instantly
- No change to coin spend mechanics

---

## AI Cost Framework

### Cost Calculation Formula

```
cost_per_pdf = (input_tokens × input_rate) + (output_tokens × output_rate) + infra_overhead
coin_price   = ceil(cost_per_pdf × margin_multiplier / coin_unit_value)
```

**Variables to configure per model:**

| Variable            | Description                                        |
|---------------------|----------------------------------------------------|
| `input_tokens`      | Average tokens in prompt + context                 |
| `output_tokens`     | Average tokens in response / generated PDF         |
| `input_rate`        | Provider cost per 1M input tokens (in INR/USD)     |
| `output_rate`       | Provider cost per 1M output tokens                 |
| `infra_overhead`    | Storage, serving, bandwidth flat cost per request  |
| `margin_multiplier` | 1.5× basic, 2.0× standard, 2.5× premium            |
| `coin_unit_value`   | INR value assigned to 1 coin (e.g., ₹0.10)         |

### Model Tier Reference

> Replace with exact live provider pricing before launch.

| Tier     | Model                        | Est. Cost/PDF (INR) | Coin Price | Notes                        |
|----------|------------------------------|---------------------|------------|------------------------------|
| Basic    | Gemini 2.0 Flash Lite        | ₹0.08–₹0.15         | 8–15       | 500 RPD free tier            |
| Standard | Gemini 2.0 Flash             | ₹0.20–₹0.45         | 20–45      | Pay-as-you-go API            |
| Premium  | Gemini 1.5 Pro / GPT-4o Mini | ₹0.50–₹1.20         | 50–120     | High quality, deep reasoning |

---

## Usage Controls

- **Free daily quota:** 2 basic PDF jobs per user (no coins needed)
- **Coin spend cap:** max 200 coins/day per user (anti-abuse)
- **Cooldown:** 60 seconds between consecutive generation jobs
- **Queue priority:**
  1. Paid coin jobs (highest)
  2. Active contributor jobs (XO score > 100)
  3. Free-tier jobs (lowest, delayed during peak)

---

## Refund Policy

| Scenario                              | Refund                     |
|---------------------------------------|----------------------------|
| AI job fails (API error)              | Full coin refund            |
| Output flagged low-confidence         | User prompted to retry or refund |
| Duplicate generation (user error)     | No refund                   |
| Admin cancels job                     | Full refund + notification  |

---

## Admin Controls

- Configure coin earn amounts per action
- Configure coin cost per task type
- Enable/disable free quota
- Manual coin credit/debit with audit note
- View per-user spend, earn, and balance history

---

## Key KPIs to Track

| Metric                          | Target at launch         |
|---------------------------------|--------------------------|
| Cost per successful PDF         | < ₹1.00                  |
| Average coins spent per MAU     | > 30 coins/month         |
| Free → recharge conversion      | > 5%                     |
| AI job success rate             | > 95%                    |
| Refund rate                     | < 3%                     |
| Queue wait time (standard tier) | < 3 minutes              |

---

## Risk Controls

- Do not promise unlimited free generation at scale
- Keep feature quality predictable and consistent by tier
- Maintain model fallback so queue never hard-fails (see `AI_MODEL_EXPANSION_PLAN.md`)
- Audit all admin coin credits monthly

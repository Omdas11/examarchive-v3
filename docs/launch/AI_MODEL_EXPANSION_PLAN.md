# AI_MODEL_EXPANSION_PLAN.md

Remove the 500 RPD bottleneck and build scalable multi-model AI infrastructure for ExamArchive.

---

## Current State

| Parameter            | Value                                                              |
|----------------------|--------------------------------------------------------------------|
| Primary model        | `gemini-3.1-flash-lite-preview` (configurable via `GEMINI_MODEL_ID` env var) |
| Daily request limit  | Configurable via `AI_DAILY_LIMIT` env var (default: 5); see `src/lib/ai-limits.ts` |
| RPM limit            | Configurable via `AI_RPM_LIMIT` env var (default: 15); see `src/lib/ai-limits.ts` |
| Existing fallback    | Gemini → OpenRouter free-tier models (see `docs/AI_SETUP.md`)     |
| Primary risk         | Queue exhaustion during peak student usage under free-tier limits  |

For authoritative current model and limit values, refer to `docs/FREE_MODELS_LIMITS.md`
and `src/lib/ai-limits.ts`. This document describes the **expanded** multi-tier
architecture needed to handle launch-scale load.

---

## Expansion Strategy

### Step 1 — Multi-Queue Request Management

Create distinct request queues with priority tiers:

| Queue Level | Description                            | Max Wait |
|-------------|----------------------------------------|----------|
| 1 — Critical | Admin/system jobs (indexing, caching) | Immediate |
| 2 — Paid     | Coin-spending user jobs                | < 2 min  |
| 3 — Contributor | Users with XO score > 100           | < 5 min  |
| 4 — Free     | New/low-activity users                 | < 15 min |

Add rate-limiter and retry scheduler with exponential back-off.

---

### Step 2 — Model Routing Layer

Route tasks to the right model by job type:

| Task Type                                   | Recommended Tier | Model (example)               |
|---------------------------------------------|------------------|-------------------------------|
| Paper metadata enrichment (post-validation) | Basic (fast)     | Gemini 3.1 Flash Lite         |
| Syllabus extraction                         | Standard         | Gemini 2.0 Flash              |
| Question paper summarization                | Standard         | Gemini 2.0 Flash              |
| AI notes PDF generation (basic)             | Basic            | Gemini 3.1 Flash Lite         |
| AI notes PDF (structured)                   | Standard         | Gemini 2.0 Flash              |
| Deep explanation / solved PDF               | Premium          | Gemini 1.5 Pro / GPT-4o Mini  |

> **Important:** Paper-code parsing and validation are **not** AI-routed tasks.
> They must always be handled by the deterministic parser as specified in
> `PAPER_CODE_VALIDATION_RULES.md` — no LLM calls in the validation path.

---

### Step 3 — Fallback Chain

When primary model quota is exhausted:

```
Job request
  ↓
Primary model available? → YES → process
  ↓ NO
Fallback model A available? → YES → process (note model used in response)
  ↓ NO
Fallback model B available? → YES → process
  ↓ NO
Defer non-critical jobs → add to queue with ETA
  ↓
Critical jobs only → alert admin
```

**Fallback models to configure:**

| Slot              | Candidate                                          |
|-------------------|----------------------------------------------------|
| Primary           | Gemini 3.1 Flash Lite (free, via `GEMINI_API_KEY`) |
| Fallback A        | Gemini 2.0 Flash (paid)                            |
| Fallback B        | Gemini 1.5 Flash (paid)                            |
| Emergency         | OpenRouter free-tier models (via `OPENROUTER_API_KEY`) |

---

### Step 4 — Prompt Cost Optimization

Reduce token usage without sacrificing output quality:

- Shorten system prompt preamble (< 200 tokens for classification tasks)
- Cache repeated context blocks (curriculum data, college info)
- Use structured output templates to minimize verbose token generation
- Compress PDF source text before sending (remove headers/footers via pre-processing)

Expected savings: **30–50% token reduction** per job after optimization.

---

### Step 5 — Caching Layer

Cache completed generation results by a composite key:

```
cache_key = hash(paper_code + source_pdf_checksum + generation_mode + prompt_version)
```

Rules:
- Cache valid for 30 days
- Cache invalidated if source PDF changes or prompt version increments
- Cache hits serve result immediately at zero AI cost
- Cache hit rate target: > 40% after 2 weeks of student usage

---

### Step 6 — Alerting

Trigger alerts when:

| Condition                                 | Alert Target    |
|-------------------------------------------|-----------------|
| Primary model quota > 80% consumed/day   | Admin dashboard |
| Primary model quota exhausted             | Admin + fallback auto-switch |
| Fallback model also exhausted             | Admin urgent alert |
| Job queue depth > 50 pending jobs         | Admin dashboard |
| AI job failure rate > 5%                  | Admin dashboard |

---

## Operational Targets

| Metric                                 | Target               |
|----------------------------------------|----------------------|
| Successful request acceptance rate     | > 99%                |
| Standard job wait time                 | < 5 minutes          |
| Classification task latency            | < 30 seconds         |
| Failed jobs without retry              | < 2%                 |
| Cache hit rate (after 2 weeks)         | > 40%                |

---

## Data to Track Per AI Request

```yaml
request_id: "req-001"
user_id: "usr-xyz"
task_type: "notes_generation"
model_used: "gemini-2.0-flash-lite"
tokens_in: 1200
tokens_out: 3400
latency_ms: 4200
success: true
coins_charged: 12
coins_refunded: 0
cache_hit: false
prompt_version: "v1.2"
```

---

## Implementation Milestones

| Step | Task                                | Target Date |
|------|-------------------------------------|-------------|
| 1    | Queue + rate limiter                | Apr 20      |
| 2    | Model router abstraction            | Apr 22      |
| 3    | Fallback chain support              | Apr 24      |
| 4    | Prompt optimization pass            | Apr 26      |
| 5    | Caching layer (basic)               | Apr 28      |
| 6    | Alerting + admin dashboard          | Apr 30      |

---

## Launch Readiness Checklist

- [ ] Fallback tested under simulated quota exhaustion
- [ ] Coin charge and refund flow tested end-to-end
- [ ] Cost dashboard visible to admin
- [ ] Prompt versions tracked and documented
- [ ] Cache hit rate monitored in dashboard
- [ ] Alert thresholds configured and tested

# AI_PROMPT_STANDARDS.md

Standard prompt templates, output schema requirements, confidence thresholds, hallucination
prevention rules, versioning policy, and failure handling for all AI jobs in ExamArchive.

---

## Prompt Template: Syllabus Extraction

**Task:** Extract structured syllabus data from a PDF or text source.

**Version:** `v1.0`

```
SYSTEM:
You are an academic data extraction assistant for ExamArchive. You extract syllabus
information from Assam University FYUG curriculum documents.

Respond ONLY with valid JSON. Do not add any explanation or commentary outside the JSON.
If you cannot confidently extract a field, set its value to null.

USER:
Extract the syllabus entry from the following text. The paper code follows the pattern:
[A-Z]{3}(DSC|DSM|SEC|IDC|AEC|VAC)(10[1-9]|15[1-9]|20[1-9]|25[1-9]|30[1-9]|35[1-9]|40[1-9]|45[1-9])[A-Z0-9]*

Return a JSON object with this exact schema:
{
  "paper_code": string,
  "paper_title": string,
  "subject_code": string | null,
  "paper_type": string | null,
  "semester_code": string | null,
  "semester_no": number | null,
  "credits": number | null,
  "marks_total": number | null,
  "unit_breakdown": [
    { "unit": number, "title": string, "lectures": number | null }
  ] | null,
  "confidence": number,
  "low_confidence_fields": [string]
}

Source text:
{SOURCE_TEXT}
```

**Output schema enforcement:** `paper_code`, `paper_title`, and `confidence` are
**mandatory and non-nullable** — if the model cannot extract these with any confidence,
return `confidence: 0` and set `paper_code`/`paper_title` to the best available guess
with the field listed in `low_confidence_fields`. All other fields may be `null` but
must be present in the response.

---

## Prompt Template: Question Ingestion

**Task:** Extract structured question data from a scanned or text question paper.

**Version:** `v1.0`

```
SYSTEM:
You are an academic data extraction assistant for ExamArchive. You extract question paper
metadata and individual questions from Assam University examination papers.

Respond ONLY with valid JSON. Do not add explanation outside the JSON.
If you cannot confidently extract a field, set its value to null.

USER:
Extract the question paper metadata and questions from the following text.

Return a JSON object with this exact schema:
{
  "paper_code": string,
  "paper_title": string | null,
  "exam_year": number,
  "exam_month": string | null,
  "exam_session": "Odd Semester" | "Even Semester" | null,
  "attempt_type": "regular" | "backlog" | "improvement" | null,
  "questions": [
    {
      "question_no": number,
      "question_subpart": string | null,
      "question_content": string,
      "marks": number | null,
      "tags": [string]
    }
  ] | null,
  "confidence": number,
  "low_confidence_fields": [string]
}

Source text:
{SOURCE_TEXT}
```

**Output schema enforcement:** `paper_code`, `exam_year`, and `confidence` are
**mandatory and non-nullable** — if the model cannot extract these with any confidence,
return `confidence: 0` and provide the best available guess with the field listed in
`low_confidence_fields`. `questions` array must have at least one entry if any questions
are detected in the source.

---

## Prompt Template: Notes / PDF Generation

**Task:** Generate structured academic notes from syllabus and question paper context.

**Version:** `v1.0`

```
SYSTEM:
You are an expert academic notes writer for Indian undergraduate science, arts, and
commerce students. You write clear, concise, exam-focused notes based on provided
syllabus content.

Respond ONLY with valid Markdown. Do not add JSON, code blocks, or commentary.
Structure your response with H2 headings for units, H3 for topics, and bullet points
for key concepts. Do not invent facts not present in the source material.

USER:
Generate structured notes for the following syllabus paper.

Paper: {PAPER_TITLE} ({PAPER_CODE})
Semester: {SEMESTER_NO}
Subject area: {SUBJECT_CODE}

Syllabus content:
{SYLLABUS_UNITS}

Frequently asked questions (from past papers):
{PAST_QUESTIONS}

Generate notes that:
- Cover each syllabus unit
- Highlight definitions, laws, and formulas
- Include one example per major concept where applicable
- End each unit with a "Key points" summary list
- Maximum 600 words per unit
```

**Output schema enforcement:** Response must be valid Markdown. Must contain H2 headings
for each unit. Minimum 100 words per unit. Any response shorter than 200 total words
is rejected as a failed generation.

---

## Confidence Thresholds

| Confidence Score | Classification   | Action                                          |
|------------------|------------------|-------------------------------------------------|
| 0.90 – 1.00      | High confidence  | Auto-accept; deliver to user                    |
| 0.70 – 0.89      | Medium confidence| Accept; flag `low_confidence_fields` for review |
| 0.50 – 0.69      | Low confidence   | Queue for Curator review before delivery         |
| 0.00 – 0.49      | Very low         | Reject; do not deliver; trigger fallback         |

### Low-Confidence Fallback Behaviour

When `confidence < 0.70`:
1. Do not deliver output directly to user.
2. Add to Curator review queue with flagged fields highlighted.
3. Notify user: *"Your request is under review for quality. Expected delivery: [ETA]."*
4. Do not charge coins until delivery is confirmed after review.
5. If review not completed within 24 hours, auto-refund coins and notify user.

---

## Hallucination Prevention Rules

These rules apply to all prompt templates:

1. **No external knowledge injection:** Prompt must supply all context. Model must not
   invent paper codes, university names, or syllabus content not in the source.

2. **Paper code validation gate:** Any paper code in AI output is passed through the
   deterministic parser from `PAPER_CODE_VALIDATION_RULES.md` before storage.
   Invalid codes → reject the output entirely.

3. **Null over guess:** If a field cannot be extracted confidently, it must be `null`.
   Never fill missing fields with plausible-sounding guesses.

4. **No invented questions:** In notes generation, questions used as context must come
   from actual past paper data — never generated.

5. **Source attribution check:** For notes generation, verify at least one syllabus unit
   heading appears in the output. If zero match, flag as hallucination risk and reject.

6. **Token budget enforcement:** If source text exceeds context window, truncate from
   the end (not the beginning), and log a `truncated: true` flag in the job record.

---

## Prompt Versioning

| Version | File ref           | Changes from previous                            | Effective date |
|---------|---------------------|--------------------------------------------------|----------------|
| v1.0    | `AI_PROMPT_STANDARDS.md` | Initial standard templates                  | 2026-04-08     |

**Versioning rules:**
- Increment patch version (v1.0 → v1.1) for wording tweaks that do not change output schema.
- Increment minor version (v1.0 → v2.0) for schema changes or new required fields.
- All jobs log which `prompt_version` was used.
- Cached outputs tied to a prompt version are invalidated when that version is replaced.

### QA Regression Process

Before deploying a new prompt version:

1. Run against a standard test set of 20 known inputs with expected outputs.
2. Compare extracted fields against ground-truth dataset.
3. Require ≥ 90% field accuracy across test set.
4. Require confidence score ≥ 0.75 average on test set.
5. Sign off in this doc by updating the version table above.
6. Deploy to production; monitor error rates for 48 hours.

---

## Failure Handling and Coin Refund Guidance

| Failure Type                              | Coin Action            | User Notification                                   |
|-------------------------------------------|------------------------|-----------------------------------------------------|
| API error (provider timeout/rate limit)   | Full refund            | "Generation failed. Coins refunded. Try again."     |
| Output schema validation failed           | Full refund            | "Output did not meet quality standards. Refunded."  |
| Low confidence — rejected after review    | Full refund            | "Quality review did not pass. Coins refunded."      |
| Low confidence — passed after review      | Coins charged on deliver | "Your notes are ready."                            |
| User-initiated cancel before generation   | Full refund            | "Job cancelled. Coins refunded."                    |
| Duplicate request (same cache key)        | No charge (cache hit)  | "Returning previous result."                        |
| Partial output (truncated context)        | Charge at 50%          | "Notes generated with partial source. Review recommended." |

All refund events are logged with job_id, user_id, coins_refunded, and reason.

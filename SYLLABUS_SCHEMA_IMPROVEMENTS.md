# SYLLABUS SCHEMA IMPROVEMENTS

> Suggestions for the Appwrite database schema, specifically `Syllabus_Table` and `ai_ingestions`,
> in the context of ingesting all **526 papers** required before launching ExamArchive for
> Haflong Government College.

---

## 1. Add `paper_name` to `Syllabus_Table`

**Current state:** `paper_name` is stored only in `Questions_Table`. `Syllabus_Table` rows lack
the paper name, which means a paper code can be fully ingested into the syllabus without being
human-readable in the UI.

**Suggested change:** Add a `paper_name` string attribute (size 255, optional) to `Syllabus_Table`.
Populate it during ingestion from the YAML frontmatter just like `Questions_Table` already does.

**Impact:** The Syllabus Tracker, paper detail pages, and export tools can display paper names
without cross-joining against `Questions_Table`.

```diff
// scripts/sync-appwrite-schema.js  –  Syllabus_Table attributes
+ { key: "paper_name", type: "string", size: 255, required: false }
```

---

## 2. Add a `stream` Index to `Syllabus_Table`

**Current state:** `stream` is stored but not indexed. With 526 papers × multiple units each,
the collection will have 2 000 + documents. Filtering by `(university, course, stream, type)`
will become a full-collection scan.

**Suggested change:** Create a compound index on `[university, course, stream, type, paper_code]`
(in that order) to speed up departmental table queries and the tracker page.

```js
// sync-appwrite-schema.js
{
  collection: "Syllabus_Table",
  key: "idx_uc_stream_type_code",
  type: "key",
  attributes: ["university", "course", "stream", "type", "paper_code"],
  orders: ["ASC", "ASC", "ASC", "ASC", "ASC"],
}
```

---

## 3. Add `semester` Attribute to `Syllabus_Table`

**Current state:** The semester can be inferred from the paper code's third character
(e.g., `PHYDSC**1**01T` → Semester 1) but is not stored explicitly.

**Suggested change:** Add `semester` (integer, 1–8, required) to `Syllabus_Table` and populate
it from the curriculum baseline (curriculum.json) during ingestion.

**Impact:** Enables efficient range queries (e.g., "all Semester 3 papers") without string
parsing on the application layer.

---

## 4. Extend `ai_ingestions` with Upload Metadata

**Current state:**
```
| paper_code | String(255) | Yes |
| file_id    | String(255) | Yes |
```
`ai_ingestions` records which file was uploaded but contains no status, timestamp, or
paper name fields, making it hard to answer "when was this paper last ingested?" or
"did the ingestion succeed?"

**Suggested additions:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `paper_name` | String(255) | No | Human-readable name extracted from frontmatter |
| `status` | String(50) | Yes | `"success"` / `"partial"` / `"failed"` |
| `ingested_at` | Datetime | Yes | Timestamp of ingestion |
| `row_count` | Integer | No | Number of syllabus rows stored |
| `error_summary` | String(2000) | No | Comma-joined parse errors for quick triage |

These fields eliminate the need to join against a separate log collection and allow the
Syllabus Tracker to determine paper status directly from `ai_ingestions`.

---

## 5. Add a `paper_code` Unique Index to `ai_ingestions`

**Current state:** There is no unique constraint on `paper_code` in `ai_ingestions`. Re-ingesting
a paper creates a duplicate log entry.

**Suggested change:** Create a unique index on `paper_code` **or** make the document `$id` the
paper code itself so that each paper has exactly one canonical log entry (updated on re-ingestion).

```js
{
  collection: "ai_ingestions",
  key: "idx_paper_code_unique",
  type: "unique",
  attributes: ["paper_code"],
}
```

---

## 6. Add `subject` to `ai_ingestions` for Department Filtering

**Current state:** `ai_ingestions` has only `paper_code` and `file_id`. To determine which
department a log entry belongs to, the application must parse the paper code prefix.

**Suggested change:** Add `subject` (string, e.g. `"Physics"`) and `dept_code` (string, e.g.
`"PHY"`) so that departmental dashboards can filter ingestions without string manipulation.

---

## 7. Pre-populate `ai_ingestions` as a To-Do Registry

**Context:** With 526 papers needed before launch, it is useful to have the full list of
expected paper codes in `ai_ingestions` at initialisation time (with `status = "pending"`).

**Suggested workflow:**
1. Run a one-time script that reads `src/data/curriculum.json` and creates one document
   per paper in `ai_ingestions` with `status = "pending"`.
2. The ingestion pipeline (`/api/admin/ingest-md`) **upserts** the document (by paper_code)
   updating `status`, `file_id`, `ingested_at`, and other fields.
3. The Syllabus Tracker can then query `ai_ingestions` directly for the full progress view,
   including papers that have never been ingested yet.

This replaces the current approach of comparing the curriculum JSON against
`Syllabus_Table` at page-load time.

---

## 8. Consider Splitting `Syllabus_Table` by Semester Group

**Context:** At full capacity (526 papers × average 5 units = ~2 630 rows) the collection is
still small. However, if future plans extend to multiple universities or additional years the
collection could grow significantly.

**Suggested approach (when needed):** Add a `semester_group` attribute:
- `"lower"` for Semesters 1–4
- `"upper"` for Semesters 5–8

This allows the UI to apply a pre-filter and halve the index scan on typical queries.

---

## 9. Enforce Strict Paper Code Format via Appwrite Attribute Validator

Appwrite supports regex validation on string attributes. The paper code convention is:

```
^[A-Z]{3}(DSC|DSM|IDC|SEC|AEC|VAC)\d{3}[ABC]?[TP]$
```

Adding this constraint to the `paper_code` attribute in both `Syllabus_Table` and
`Questions_Table` will reject malformed paper codes at the database layer before they
pollute the tracker.

**Exception:** Common papers (e.g., `EVSVAC151T`, `ENGAEC101T`) match the pattern already.
No special handling required.

---

## 10. Summary of Recommended Priority Changes

| # | Change | Priority | Effort |
|---|--------|----------|--------|
| 1 | Add `paper_name` to `Syllabus_Table` | **High** | Low |
| 2 | Compound index on `Syllabus_Table` | **High** | Low |
| 3 | Add `semester` to `Syllabus_Table` | Medium | Low |
| 4 | Extend `ai_ingestions` with metadata | **High** | Medium |
| 5 | Unique index on `ai_ingestions.paper_code` | **High** | Low |
| 6 | Add `subject`/`dept_code` to `ai_ingestions` | Medium | Low |
| 7 | Pre-populate `ai_ingestions` as to-do registry | Medium | Medium |
| 8 | Semester-group split | Low | Medium |
| 9 | Regex validator on `paper_code` | Low | Low |

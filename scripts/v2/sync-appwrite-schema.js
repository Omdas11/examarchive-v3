#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createAppwriteDatabasesClient } = require("./appwrite-schema-setup");
const {
  mergeCollectionDefinition,
  parseDatabaseSchemaMarkdown,
  renderSyncRemarks,
  upsertSyncRemarks,
} = require("./md-sync-utils");
const { ensureMasterNotesPrompt, MASTER_NOTES_PROMPT_PATH } = require("../ensure-master-notes-prompt");

const DATABASE_ID = "examarchive";
const STANDARD_STRING_SIZE = 512;
const FILENAME_SIZE = 512;
const LARGE_STRING_SIZE = 8192;
const TEXT_CHUNK_SIZE = 1000000;
const REFERRAL_CODE_SIZE = 6;
const MARKDOWN_FILE_ID_SIZE = 100;
/** NEP 2020 FYUG semester range (1–8). */
const MIN_SEMESTER = 1;
const MAX_SEMESTER = 8;
const DATABASE_SCHEMA_DOC_PATH = path.resolve(__dirname, "../../docs/DATABASE_SCHEMA.md");
const STATUS_BLOCK_START = "<!-- SCHEMA_SYNC_STATUS_START -->";
const STATUS_BLOCK_END = "<!-- SCHEMA_SYNC_STATUS_END -->";
const RESOURCE_BLOCK_START = "<!-- SCHEMA_SYNC_RESOURCES_START -->";
const RESOURCE_BLOCK_END = "<!-- SCHEMA_SYNC_RESOURCES_END -->";
const BACKEND_BUCKETS = [
  "papers",
  "notes",
  "avatars",
  "syllabus-files",
  "examarchive-syllabus-md-ingestion",
  "examarchive_question_ingest_assets",
  "generated-md-cache",
  "cached-unit-notes",
  "cached-solved-papers",
];
const EMPTY_STRING_COMPARISON = Object.freeze({
  existingCount: 0,
  perfectCount: 0,
  differenceCount: 0,
  differenceDetails: [],
});
const DEFAULT_DATABASE_SCHEMA_MARKDOWN = `# DATABASE_SCHEMA

## Table: \`Syllabus_Table\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`id\` | String | **Yes** | Document ID |
| \`university\` | String | **Yes** | University name |
| \`course\` | String | **Yes** | Course name (FYUG/CBCS) |
| \`stream\` | String | **Yes** | Stream name (Arts/Science/Commerce) |
| \`type\` | String | **Yes** | Paper type (DSC/DSM/SEC/AEC/VAC/IDC) |
| \`paper_code\` | String | **Yes** | Paper code |
| \`paper_name\` | String | No | Paper name (from YAML frontmatter) |
| \`subject\` | String | No | Subject / department name |
| \`semester\` | Integer | No | Semester number (1–8) |
| \`unit_number\` | Integer | **Yes** | Unit number |
| \`syllabus_content\` | String | **Yes** | Unit syllabus content |
| \`lectures\` | Integer | No | Number of lectures |
| \`tags\` | String | No | Topic tags |

## Table: \`Questions_Table\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`id\` | String | **Yes** | Document ID |
| \`university\` | String | **Yes** | University name |
| \`course\` | String | **Yes** | Course name (FYUG/CBCS) |
| \`stream\` | String | **Yes** | Stream name (Arts/Science/Commerce) |
| \`type\` | String | **Yes** | Paper type |
| \`paper_code\` | String | **Yes** | Paper code |
| \`paper_name\` | String | No | Paper name |
| \`question_no\` | String | No | Question number |
| \`question_subpart\` | String | No | Subpart label |
| \`year\` | Integer | No | Exam year |
| \`question_content\` | String | **Yes** | Question content |
| \`marks\` | Integer | No | Marks |
| \`tags\` | String | No | Topic tags |

## Table: \`Generated_Notes_Cache\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`id\` | String | **Yes** | Document ID |
| \`university\` | String | No | University selector for unit-notes cache lookups |
| \`course\` | String | No | Course selector for unit-notes cache lookups |
| \`stream\` | String | No | Stream selector for unit-notes cache lookups |
| \`selection_type\` | String | No | Type selector used by unit-notes requests |
| \`paper_code\` | String | **Yes** | Paper code |
| \`type\` | String | **Yes** | Cache type (\`solved_paper\` or \`unit_notes\`) |
| \`year\` | String | No | Solved-paper exam year |
| \`semester\` | String | No | Semester selector |
| \`unit_number\` | Integer | **Yes** | Unit number |
| \`part_number\` | Integer | No | Current part index for long generations |
| \`markdown_file_id\` | String | **Yes** | Appwrite Storage file ID for cached markdown |
| \`generated_markdown\` | String | No | Cached markdown text |
| \`syllabus_content\` | String | No | Cached syllabus bullets text for print cover |
| \`pdf_file_id\` | String | No | Cached rendered PDF file id for direct reuse |
| \`created_at\` | Datetime | **Yes** | Cache creation timestamp |
| \`status\` | String | **Yes** | Cache status (\`generating\` or \`completed\`) |
| \`last_processed_index\` | Integer | No | Last processed question index for resume |

## Table: \`User_Quotas\`

| Field | Type | Required | Notes |
|---|---|---|---|
| \`id\` | String | **Yes** | Document ID |
| \`user_id\` | String | **Yes** | User ID |
| \`notes_generated_today\` | Integer | **Yes** | Daily unit notes count |
| \`papers_solved_today\` | Integer | **Yes** | Daily solved papers count |
| \`last_generation_date\` | String | **Yes** | UTC date key (\`YYYY-MM-DD\`) |

`;

const TARGET_SCHEMA = [
  {
    id: "papers",
    name: "papers",
    attributes: [
      { key: "course_code", type: "string", required: true, size: 64 },
      { key: "paper_name", type: "string", required: false, size: 256 },
      { key: "year", type: "integer", required: true },
      { key: "semester", type: "string", required: false, size: 32 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "programme", type: "string", required: false, size: 64 },
      { key: "exam_type", type: "string", required: false, size: 32 },
      { key: "institute", type: "string", required: false, size: 256 },
      { key: "institution", type: "string", required: false, size: 256 },
      { key: "stream", type: "string", required: false, size: 128 },
      { key: "paper_type", type: "string", required: false, size: 32 },
      { key: "marks", type: "integer", required: false },
      { key: "duration", type: "integer", required: false },
      { key: "file_id", type: "string", required: false, size: 64 },
      { key: "file_url", type: "string", required: true, size: 2048 },
      { key: "uploaded_by", type: "string", required: false, size: 64 },
      { key: "uploaded_by_username", type: "string", required: false, size: 128 },
      { key: "approved", type: "boolean", required: true, default: false },
      { key: "status", type: "string", required: false, size: 32 },
      { key: "view_count", type: "integer", required: false },
      { key: "download_count", type: "integer", required: false },
    ],
  },
  {
    id: "syllabus",
    name: "syllabus",
    attributes: [
      { key: "university", type: "string", required: false, size: 256 },
      { key: "subject", type: "string", required: false, size: 256 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "semester", type: "string", required: false, size: 32 },
      { key: "programme", type: "string", required: false, size: 64 },
      { key: "year", type: "integer", required: false },
      { key: "uploader_id", type: "string", required: false, size: 64 },
      { key: "approval_status", type: "string", required: false, size: 32 },
      { key: "file_url", type: "string", required: false, size: 2048 },
      { key: "uploaded_by_username", type: "string", required: false, size: 128 },
      { key: "course_code", type: "string", required: false, size: 64 },
      { key: "course_name", type: "string", required: false, size: 256 },
      { key: "is_hidden", type: "boolean", required: false, default: false },
    ],
  },
  {
    id: "users",
    name: "users",
    attributes: [
      { key: "email", type: "string", required: true, size: 320 },
      { key: "role", type: "string", required: true, size: 64 },
      { key: "primary_role", type: "string", required: false, size: 64 },
      { key: "secondary_role", type: "string", required: false, size: 64 },
      { key: "tertiary_role", type: "string", required: false, size: 64 },
      { key: "tier", type: "string", required: false, size: 32 },
      { key: "display_name", type: "string", required: false, size: 128 },
      { key: "username", type: "string", required: false, size: 64 },
      { key: "xp", type: "integer", required: false },
      { key: "streak_days", type: "integer", required: false },
      { key: "avatar_url", type: "string", required: false, size: 2048 },
      { key: "avatar_file_id", type: "string", required: false, size: 64 },
      { key: "last_activity", type: "datetime", required: false },
      {
        key: "upload_count",
        type: "integer",
        required: false,
      },
      {
        key: "username_last_changed",
        type: "string",
        required: false,
        size: 64,
      },
      { key: "referral_code", type: "string", required: false, size: REFERRAL_CODE_SIZE },
      { key: "ai_credits", type: "integer", required: false },
      { key: "referred_by", type: "string", required: false, size: 64 },
      { key: "referral_path", type: "string", required: false, size: 64, array: true },
      { key: "referred_users_count", type: "integer", required: false },
      { key: "specialist_subject", type: "string", required: false, size: 128 },
      { key: "subject_admin_subject", type: "string", required: false, size: 128 },
      // Added by PR#246 — Electron Economy / Passes & Subscriptions
      { key: "last_weekly_claim_at", type: "datetime", required: false },
      // size 128 = max length per badge string in the array (e.g. "supporter_badge")
      { key: "badges", type: "string", required: false, size: 128, array: true },
    ],
  },
  {
    id: "purchases",
    name: "purchases",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "email", type: "string", required: false, size: 320 },
      { key: "provider", type: "string", required: true, size: 32 },
      { key: "order_id", type: "string", required: true, size: 128 },
      { key: "payment_id", type: "string", required: false, size: 128 },
      { key: "status", type: "string", required: true, size: 32 },
      { key: "product_code", type: "string", required: true, size: 64 },
      { key: "amount", type: "integer", required: true },
      { key: "currency", type: "string", required: true, size: 8 },
      { key: "credits_granted", type: "integer", required: false },
      { key: "credits_applied", type: "boolean", required: false, default: false },
      { key: "credit_applying_at", type: "datetime", required: false },
      { key: "pre_credit_balance", type: "integer", required: false },
      { key: "raw_payload", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "verified_at", type: "datetime", required: false },
    ],
  },
  {
    id: "uploads",
    name: "uploads",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "file_id", type: "string", required: true, size: 64 },
      { key: "file_name", type: "string", required: true, size: FILENAME_SIZE },
      { key: "status", type: "string", required: true, size: 32 },
    ],
  },
  {
    id: "activity_logs",
    name: "activity_logs",
    attributes: [
      { key: "action", type: "string", required: true, size: 64 },
      { key: "target_user_id", type: "string", required: false, size: 64 },
      { key: "target_paper_id", type: "string", required: false, size: 64 },
      { key: "admin_id", type: "string", required: false, size: 64 },
      { key: "admin_email", type: "string", required: false, size: 320 },
      { key: "details", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "meta", type: "string", required: true, size: LARGE_STRING_SIZE },
    ],
  },
  {
    id: "achievements",
    name: "achievements",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "slug", type: "string", required: true, size: 128 },
      { key: "label", type: "string", required: true, size: 256 },
      { key: "description", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "earned_at", type: "datetime", required: true },
    ],
  },
  // ── PR#246: Electron Economy — Passes & Subscriptions ──────────────────────
  {
    id: "user_passes",
    name: "user_passes",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "pass_id", type: "string", required: true, size: 32 },
      { key: "mode", type: "string", required: true, size: 16 },
      { key: "status", type: "string", required: true, size: 16 },
      { key: "daily_electrons", type: "integer", required: true },
      { key: "days_remaining", type: "integer", required: true },
      { key: "last_daily_claim_at", type: "datetime", required: false },
      { key: "activated_at", type: "datetime", required: true },
      { key: "expires_at", type: "datetime", required: true },
      { key: "razorpay_subscription_id", type: "string", required: false, size: 128 },
      { key: "razorpay_order_id", type: "string", required: false, size: 128 },
    ],
  },
  {
    id: "user_badges",
    name: "user_badges",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "badge_id", type: "string", required: true, size: 64 },
      { key: "awarded_at", type: "datetime", required: true },
      { key: "source", type: "string", required: false, size: 128 },
    ],
  },
  {
    id: "site_metrics",
    name: "site_metrics",
    attributes: [
      { key: "visitor_count", type: "integer", required: true },
      { key: "launch_progress", type: "integer", required: false },
    ],
  },
  {
    id: "feedback",
    name: "feedback",
    attributes: [
      { key: "name", type: "string", required: true, size: 128 },
      { key: "university", type: "string", required: false, size: 256 },
      { key: "text", type: "string", required: true, size: LARGE_STRING_SIZE },
      { key: "approved", type: "boolean", required: true, default: false },
    ],
  },
  {
    id: "ai_usage",
    name: "ai_usage",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "date", type: "string", required: true, size: 10 },
    ],
  },
  {
    id: "ai_embeddings",
    name: "ai_embeddings",
    attributes: [
      { key: "file_id", type: "string", required: true, size: 64 },
      { key: "source_type", type: "string", required: true, size: 32 },
      { key: "source_label", type: "string", required: true, size: 512 },
      { key: "course_code", type: "string", required: false, size: 64 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "year", type: "integer", required: false },
      { key: "uploaded_by", type: "string", required: false, size: 64 },
      { key: "embedding_model", type: "string", required: true, size: 128 },
      { key: "chunk_index", type: "integer", required: true },
      { key: "text_chunk", type: "string", required: true, size: TEXT_CHUNK_SIZE },
      { key: "embedding", type: "float", required: true, array: true },
    ],
  },
  {
    id: "pdf_usage",
    name: "pdf_usage",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "date", type: "string", required: true, size: 10 },
    ],
  },
  {
    id: "Syllabus_Table",
    name: "Syllabus_Table",
    attributes: [
      { key: "entry_type", type: "string", required: false, size: 32 },
      { key: "entry_id", type: "string", required: false, size: 128 },
      { key: "college", type: "string", required: false, size: 256 },
      { key: "university", type: "string", required: true, size: 256 },
      { key: "course", type: "string", required: true, size: 64 },
      { key: "stream", type: "string", required: true, size: 64 },
      { key: "group", type: "string", required: false, size: 256 },
      { key: "session", type: "string", required: false, size: 64 },
      { key: "year", type: "integer", required: false },
      { key: "type", type: "string", required: true, size: 32 },
      { key: "paper_code", type: "string", required: true, size: 128 },
      // paper_name stored alongside units so the tracker can show names without
      // cross-joining against Questions_Table (added for syllabus tracker feature).
      { key: "paper_name", type: "string", required: false, size: 255 },
      { key: "subject", type: "string", required: false, size: 256 },
      { key: "semester_code", type: "string", required: false, size: 16 },
      { key: "semester_no", type: "integer", required: false, min: MIN_SEMESTER, max: MAX_SEMESTER },
      // semester (1–8) stored explicitly for efficient range queries.
      { key: "semester", type: "integer", required: false, min: MIN_SEMESTER, max: MAX_SEMESTER },
      { key: "credits", type: "integer", required: false },
      { key: "marks_total", type: "integer", required: false },
      { key: "syllabus_pdf_url", type: "string", required: false, size: 2048 },
      { key: "source_reference", type: "string", required: false, size: 512 },
      { key: "status", type: "string", required: false, size: 64 },
      { key: "aliases", type: "string", required: false, size: 256, array: true },
      { key: "keywords", type: "string", required: false, size: 128, array: true },
      { key: "notes", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "version", type: "integer", required: false },
      { key: "last_updated", type: "string", required: false, size: 32 },
      { key: "unit_number", type: "integer", required: true },
      { key: "syllabus_content", type: "string", required: true, size: TEXT_CHUNK_SIZE },
      { key: "lectures", type: "integer", required: false },
      { key: "tags", type: "string", required: false, size: 128, array: true },
    ],
  },
  {
    id: "Questions_Table",
    name: "Questions_Table",
    attributes: [
      { key: "entry_type", type: "string", required: false, size: 32 },
      { key: "question_id", type: "string", required: false, size: 128 },
      { key: "college", type: "string", required: false, size: 256 },
      { key: "university", type: "string", required: true, size: 256 },
      { key: "course", type: "string", required: true, size: 64 },
      { key: "stream", type: "string", required: true, size: 64 },
      { key: "group", type: "string", required: false, size: 256 },
      { key: "type", type: "string", required: true, size: 32 },
      { key: "paper_code", type: "string", required: true, size: 128 },
      { key: "paper_name", type: "string", required: false, size: 256 },
      { key: "subject", type: "string", required: false, size: 256 },
      { key: "exam_year", type: "integer", required: false },
      { key: "exam_session", type: "string", required: false, size: 64 },
      { key: "exam_month", type: "string", required: false, size: 32 },
      { key: "attempt_type", type: "string", required: false, size: 32 },
      { key: "semester_code", type: "string", required: false, size: 16 },
      { key: "semester_no", type: "integer", required: false, min: MIN_SEMESTER, max: MAX_SEMESTER },
      { key: "question_pdf_url", type: "string", required: false, size: 2048 },
      { key: "source_reference", type: "string", required: false, size: 512 },
      { key: "status", type: "string", required: false, size: 64 },
      { key: "question_no", type: "string", required: false, size: 32 },
      { key: "question_subpart", type: "string", required: false, size: 32 },
      { key: "year", type: "integer", required: false },
      { key: "question_content", type: "string", required: true, size: TEXT_CHUNK_SIZE },
      { key: "marks", type: "integer", required: false },
      { key: "tags", type: "string", required: false, size: 128, array: true },
      { key: "linked_syllabus_entry_id", type: "string", required: false, size: 128 },
      { key: "link_status", type: "string", required: false, size: 32 },
      { key: "ocr_text_path", type: "string", required: false, size: 512 },
      { key: "ai_summary_status", type: "string", required: false, size: 32 },
      { key: "difficulty_estimate", type: "string", required: false, size: 32 },
    ],
  },
  {
    id: "Generated_Notes_Cache",
    name: "Generated_Notes_Cache",
    attributes: [
      { key: "university", type: "string", required: false, size: 256 },
      { key: "course", type: "string", required: false, size: 64 },
      { key: "stream", type: "string", required: false, size: 64 },
      { key: "selection_type", type: "string", required: false, size: 32 },
      { key: "paper_code", type: "string", required: true, size: 128 },
      { key: "type", type: "string", required: true, size: 50 },
      { key: "year", type: "string", required: false, size: 10 },
      { key: "semester", type: "string", required: false, size: 10 },
      { key: "unit_number", type: "integer", required: true },
      { key: "part_number", type: "integer", required: false },
      { key: "markdown_file_id", type: "string", required: true, size: MARKDOWN_FILE_ID_SIZE },
      { key: "generated_markdown", type: "string", required: false, size: TEXT_CHUNK_SIZE },
      { key: "syllabus_content", type: "string", required: false, size: TEXT_CHUNK_SIZE },
      { key: "pdf_file_id", type: "string", required: false, size: 100 },
      { key: "created_at", type: "datetime", required: true },
      { key: "status", type: "string", required: true, size: 50 },
      { key: "last_processed_index", type: "integer", required: false },
    ],
  },
  {
    id: "User_Quotas",
    name: "User_Quotas",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "notes_generated_today", type: "integer", required: true },
      { key: "papers_solved_today", type: "integer", required: true },
      { key: "last_generation_date", type: "string", required: true, size: 10 },
    ],
  },
];

function isNotFoundError(error) {
  const rawCode = error?.code ?? error?.response?.code;
  const code = Number(rawCode);
  const message = String(error?.message ?? error?.response?.message ?? "");
  return code === 404 || /not found/i.test(message);
}

function isAttributeAlreadyExistsError(error) {
  const rawCode = error?.code ?? error?.response?.code;
  const code = Number(rawCode);
  const type = error?.type ?? error?.response?.type;
  const message = String(error?.message ?? error?.response?.message ?? "");
  return (code === 409 && /already exist(s)?/i.test(message)) || type === "attribute_already_exists";
}

function isAttributeLimitExceeded(error) {
  const type = error?.type ?? error?.response?.type;
  return type === "attribute_limit_exceeded";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMissingAttributes(targetAttributes, liveAttributes) {
  const existingKeys = new Set(liveAttributes.map((attribute) => attribute.key));
  return targetAttributes.filter((attribute) => !existingKeys.has(attribute.key));
}

function formatType(type, array) {
  return array ? `${type}[]` : type;
}

function formatMismatch(mismatch) {
  switch (mismatch.kind) {
    case "type":
      return `type live=${formatType(mismatch.live, mismatch.liveArray)} target=${formatType(mismatch.target, mismatch.targetArray)}`;
    case "required":
      return `required live=${Boolean(mismatch.live)} target=${Boolean(mismatch.target)}`;
    case "array":
      return `array live=${Boolean(mismatch.live)} target=${Boolean(mismatch.target)}`;
    case "size":
      return `size live=${String(mismatch.live)} target=${String(mismatch.target)}`;
    case "min":
      return `min live=${String(mismatch.live)} target=${String(mismatch.target)}`;
    case "max":
      return `max live=${String(mismatch.live)} target=${String(mismatch.target)}`;
    default:
      return `${mismatch.kind} differs`;
  }
}

function getAppwriteDefaultValue(collectionId, attribute) {
  if (attribute.required && typeof attribute.default !== "undefined") {
    console.warn(
      `[warn] ${collectionId}.${attribute.key} defines a default but is required. ` +
        "Appwrite does not allow defaults on required attributes, so the default is omitted.",
    );
  }
  if (attribute.required) {
    return undefined;
  }
  return attribute.default;
}

function printMismatchWarning(collectionId, target, live) {
  const mismatches = [];
  if (live.type !== target.type) {
    mismatches.push({
      kind: "type",
      live: live.type,
      target: target.type,
      liveArray: Boolean(live.array),
      targetArray: Boolean(target.array),
    });
  }
  if (Boolean(live.required) !== Boolean(target.required)) {
    mismatches.push({ kind: "required", live: Boolean(live.required), target: Boolean(target.required) });
  }
  if (Boolean(live.array) !== Boolean(target.array)) {
    mismatches.push({ kind: "array", live: Boolean(live.array), target: Boolean(target.array) });
  }
  if (target.type === "string" && typeof target.size === "number" && live.size !== target.size) {
    mismatches.push({ kind: "size", live: live.size, target: target.size });
  }
  if (
    (target.type === "integer" || target.type === "float") &&
    typeof target.min !== "undefined" &&
    live.min !== target.min
  ) {
    mismatches.push({ kind: "min", live: live.min, target: target.min });
  }
  if (
    (target.type === "integer" || target.type === "float") &&
    typeof target.max !== "undefined" &&
    live.max !== target.max
  ) {
    mismatches.push({ kind: "max", live: live.max, target: target.max });
  }
  if (mismatches.length > 0) {
    console.warn(
      `[warn] ${collectionId}.${target.key} exists but differs (${mismatches.map(formatMismatch).join(", ")}). ` +
        "Script only creates missing attributes and does not mutate existing definitions.",
    );
    return { mismatchCount: 1, mismatches };
  }
  return { mismatchCount: 0, mismatches: [] };
}

async function waitForAttributeAvailability(
  databases,
  databaseId,
  collectionId,
  key,
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const attribute = await databases.getAttribute(databaseId, collectionId, key);
      if (attribute.status === "available") {
        return attribute;
      }
      if (attribute.status === "failed" || attribute.status === "stuck") {
        throw new Error(
          `Attribute ${collectionId}.${key} failed with status "${attribute.status}": ${attribute.error || "unknown error"}`,
        );
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${collectionId}.${key} to become available`);
}

async function createAttribute(databases, databaseId, collectionId, attribute) {
  const defaultValue = getAppwriteDefaultValue(collectionId, attribute);
  switch (attribute.type) {
    case "string":
      return databases.createStringAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.size ?? STANDARD_STRING_SIZE,
        attribute.required,
        defaultValue,
        Boolean(attribute.array),
      );
    case "integer":
      return databases.createIntegerAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.min,
        attribute.max,
        defaultValue,
        Boolean(attribute.array),
      );
    case "boolean":
      return databases.createBooleanAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        defaultValue,
        Boolean(attribute.array),
      );
    case "datetime":
      return databases.createDatetimeAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        defaultValue,
        Boolean(attribute.array),
      );
    case "float":
      return databases.createFloatAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.min,
        attribute.max,
        defaultValue,
        Boolean(attribute.array),
      );
    default:
      throw new Error(`Unsupported attribute type "${attribute.type}" for ${collectionId}.${attribute.key}`);
  }
}

async function ensureCollectionExists(databases, databaseId, collection) {
  try {
    await databases.getCollection(databaseId, collection.id);
    return false;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await databases.createCollection(databaseId, collection.id, collection.name);
    return true;
  }
}

async function syncCollection(databases, databaseId, collection) {
  const created = await ensureCollectionExists(databases, databaseId, collection);
  console.log(created ? `[create] collection ${collection.id}` : `[exists] collection ${collection.id}`);

  const liveAttributesResponse = await databases.listAttributes(databaseId, collection.id);
  const liveAttributes = liveAttributesResponse.attributes;
  const liveByKey = new Map(liveAttributes.map((attribute) => [attribute.key, attribute]));
  const missingAttributes = getMissingAttributes(collection.attributes, liveAttributes);

  let mismatchCount = 0;
  let createdAttributes = 0;
  let attributeLimitExceeded = false;
  const stringComparison = {
    existingCount: 0,
    perfectCount: 0,
    differenceCount: 0,
    differenceDetails: [],
  };
  for (const attribute of collection.attributes) {
    const existing = liveByKey.get(attribute.key);
    if (existing) {
      const { mismatchCount: attributeMismatchCount, mismatches } = printMismatchWarning(collection.id, attribute, existing);
      mismatchCount += attributeMismatchCount;

      if (attribute.type === "string") {
        stringComparison.existingCount += 1;
        const stringMismatches = mismatches.filter((mismatch) =>
          mismatch.kind === "type" ||
          mismatch.kind === "required" ||
          mismatch.kind === "array" ||
          mismatch.kind === "size",
        );
        if (stringMismatches.length > 0) {
          stringComparison.differenceCount += 1;
          const exactParts = stringMismatches.map((mismatch) => {
            if (mismatch.kind === "type") {
              return `type ${formatType(mismatch.live, mismatch.liveArray)} → ${formatType(
                mismatch.target,
                mismatch.targetArray,
              )}`;
            }
            return `${mismatch.kind} ${String(mismatch.live)} → ${String(mismatch.target)}`;
          });
          stringComparison.differenceDetails.push(
            `${attribute.key}: ${exactParts.join(", ")}`,
          );
        } else {
          stringComparison.perfectCount += 1;
        }
      }
    }
  }

  for (const attribute of missingAttributes) {
    console.log(`[create] attribute ${collection.id}.${attribute.key} (${formatType(attribute.type, attribute.array)})`);
    try {
      await createAttribute(databases, databaseId, collection.id, attribute);
      createdAttributes += 1;
    } catch (error) {
      if (isAttributeLimitExceeded(error)) {
        attributeLimitExceeded = true;
        console.warn(
          `[warn] attribute limit reached for ${collection.id} while creating ${attribute.key}; ` +
            "skipping remaining attributes. Appwrite collection schemas have practical per-collection limits, so " +
            "remove unused attributes and prefer very-large string fields for long free-text payloads.",
        );
        break;
      }
      if (!isAttributeAlreadyExistsError(error)) {
        throw error;
      }
      console.warn(
        `[warn] ${collection.id}.${attribute.key} already exists while creating. ` +
          "Proceeding to wait for attribute availability.",
      );
    }
    await waitForAttributeAvailability(databases, databaseId, collection.id, attribute.key);
    console.log(`[ready] attribute ${collection.id}.${attribute.key}`);
  }

  if (missingAttributes.length === 0) {
    console.log(`[up-to-date] ${collection.id} has all required attributes`);
  }

  return {
    collectionId: collection.id,
    createdCollection: created,
    totalTargetAttributes: collection.attributes.length,
    createdAttributes,
    mismatchCount,
    connected: mismatchCount === 0 && !attributeLimitExceeded,
    attributeLimitExceeded,
    stringComparison,
  };
}

function renderSchemaStatusSection(results) {
  const lines = [
    "## Schema Sync Status (Auto-generated)",
    "",
    "_This v2 schema section is updated by `scripts/v2/sync-appwrite-schema.js` when run with `--update-schema-md`._",
    "",
    "| Collection | Status | Created in run | String type sync | Notes |",
    "|---|---|---:|---|---|",
  ];

  for (const result of results) {
    const stringComparison = result.stringComparison ?? EMPTY_STRING_COMPARISON;
    const status = result.connected ? "✅ Perfectly connected" : "⚠️ Connected with differences";
    const createdInRun = result.createdAttributes + (result.createdCollection ? 1 : 0);
    const stringSync = stringComparison.existingCount === 0
      ? "n/a"
      : stringComparison.differenceCount === 0
        ? `✅ ${stringComparison.perfectCount}/${stringComparison.existingCount} perfect`
        : `⚠️ ${stringComparison.perfectCount}/${stringComparison.existingCount} perfect, ${stringComparison.differenceCount} different`;
    const notes = [
      result.createdCollection ? "collection created" : "collection existed",
      `${result.createdAttributes}/${result.totalTargetAttributes} missing attrs created`,
      result.mismatchCount > 0 ? `${result.mismatchCount} attr definition mismatch(es)` : "no mismatches detected",
      stringComparison.differenceDetails.length > 0
        ? `string diffs: ${stringComparison.differenceDetails.slice(0, 2).join(" | ")}${
            stringComparison.differenceDetails.length > 2
              ? ` (+${stringComparison.differenceDetails.length - 2} more)`
              : ""
          }`
        : "string type/size aligned",
    ].join("; ");
    const safeStringSync = escapeMarkdownTableCell(stringSync);
    const safeNotes = escapeMarkdownTableCell(notes);

    lines.push(`| \`${result.collectionId}\` | ${status} | ${createdInRun} | ${safeStringSync} | ${safeNotes} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function escapeMarkdownTableCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function upsertSchemaStatusBlock(markdown, statusSection) {
  const wrapped = `${STATUS_BLOCK_START}\n${statusSection}\n${STATUS_BLOCK_END}`;
  const startIndex = markdown.indexOf(STATUS_BLOCK_START);
  const endIndex = markdown.indexOf(STATUS_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = markdown.slice(0, startIndex).replace(/\s*$/, "");
    const after = markdown.slice(endIndex + STATUS_BLOCK_END.length).replace(/^\s*/, "");
    return `${before}\n\n${wrapped}\n\n${after}`.trimEnd() + "\n";
  }

  return `${markdown.trimEnd()}\n\n---\n\n${wrapped}\n`;
}

function renderBackendResourcesSection() {
  const lines = [
    "## Backend Resource Map (Auto-generated)",
    "",
    "_Generated from `scripts/v2/sync-appwrite-schema.js` to reflect backend-configured Appwrite resources._",
    "",
    `**Database:** \`${DATABASE_ID}\``,
    "",
    "### Storage Buckets",
    "",
    "| Bucket ID | Purpose |",
    "|---|---|",
    ...BACKEND_BUCKETS.map((bucketId) => `| \`${bucketId}\` | Backend configured bucket |`),
    "",
    "### Database Collections",
    "",
    "| Collection ID | In target schema |",
    "|---|---|",
    ...TARGET_SCHEMA.map((collection) => `| \`${collection.id}\` | ✅ |`),
    "",
  ];

  return lines.join("\n");
}

function upsertBackendResourcesBlock(markdown) {
  const content = `${RESOURCE_BLOCK_START}\n${renderBackendResourcesSection()}\n${RESOURCE_BLOCK_END}`;
  const startIndex = markdown.indexOf(RESOURCE_BLOCK_START);
  const endIndex = markdown.indexOf(RESOURCE_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = markdown.slice(0, startIndex).replace(/\s*$/, "");
    const after = markdown.slice(endIndex + RESOURCE_BLOCK_END.length).replace(/^\s*/, "");
    return `${before}\n\n${content}\n\n${after}`.trimEnd() + "\n";
  }

  return `${markdown.trimEnd()}\n\n---\n\n${content}\n`;
}

function updateSchemaDocWithStatus(results, filePath = DATABASE_SCHEMA_DOC_PATH) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, DEFAULT_DATABASE_SCHEMA_MARKDOWN, "utf8");
  }
  const current = fs.readFileSync(filePath, "utf8");
  const statusSection = renderSchemaStatusSection(results);
  const withResources = upsertBackendResourcesBlock(current);
  const next = upsertSchemaStatusBlock(withResources, statusSection);
  if (next !== current) {
    fs.writeFileSync(filePath, next, "utf8");
    console.log(`[update] wrote schema sync status to ${filePath}`);
  } else {
    console.log("[up-to-date] schema markdown status already current");
  }
}

async function main() {
  const shouldUpdateSchemaDoc = process.argv.includes("--update-schema-md");
  const databases = createAppwriteDatabasesClient();
  ensureMasterNotesPrompt();

  console.log(`Starting Appwrite schema sync for database "${DATABASE_ID}"`);
  if (!fs.existsSync(DATABASE_SCHEMA_DOC_PATH)) {
    fs.writeFileSync(DATABASE_SCHEMA_DOC_PATH, DEFAULT_DATABASE_SCHEMA_MARKDOWN, "utf8");
  }
  const parsedFromMarkdown = parseDatabaseSchemaMarkdown(fs.readFileSync(DATABASE_SCHEMA_DOC_PATH, "utf8"));
  const parsedById = new Map(parsedFromMarkdown.map((collection) => [collection.id, collection]));
  const effectiveSchema = TARGET_SCHEMA.map((collection) =>
    mergeCollectionDefinition(collection, parsedById.get(collection.id)),
  );
  const results = [];
  for (const collection of effectiveSchema) {
    results.push(await syncCollection(databases, DATABASE_ID, collection));
  }
  if (shouldUpdateSchemaDoc) {
    updateSchemaDocWithStatus(results);
    const connected = results
      .filter((result) => result.connected)
      .map((result) => `${result.collectionId} updated successfully.`);
    const errors = results
      .filter((result) => !result.connected)
      .map((result) => `${result.collectionId} has ${result.mismatchCount} mismatch(es).`);
    const overallStatus = errors.length === 0 ? "Success" : connected.length > 0 ? "Partial" : "Failed";
    const remarks = renderSyncRemarks({
      timestamp: new Date().toISOString(),
      overallStatus,
      connected,
      errors,
    });
    const schemaCurrent = fs.readFileSync(DATABASE_SCHEMA_DOC_PATH, "utf8");
    fs.writeFileSync(DATABASE_SCHEMA_DOC_PATH, upsertSyncRemarks(schemaCurrent, remarks), "utf8");

    const promptCurrent = fs.readFileSync(MASTER_NOTES_PROMPT_PATH, "utf8");
    const promptRemarks = renderSyncRemarks({
      timestamp: new Date().toISOString(),
      overallStatus: "Success",
      connected: ["MASTER_NOTES_PROMPT.md loaded and synced."],
      errors: [],
    });
    fs.writeFileSync(MASTER_NOTES_PROMPT_PATH, upsertSyncRemarks(promptCurrent, promptRemarks), "utf8");
  }
  console.log("Schema sync complete.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Schema sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  DATABASE_ID,
  TARGET_SCHEMA,
  createAttribute,
  getMissingAttributes,
  getAppwriteDefaultValue,
  isAttributeAlreadyExistsError,
  isAttributeLimitExceeded,
  isNotFoundError,
  renderSchemaStatusSection,
  syncCollection,
  updateSchemaDocWithStatus,
  upsertSchemaStatusBlock,
  waitForAttributeAvailability,
};

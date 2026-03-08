# ExamArchive v3 — Backend Cleanup Guide

This document identifies deprecated or potentially removable fields across all Appwrite
collections and provides safe step-by-step instructions for maintainers to clean up the
database without data loss.

> **Warning:** Always take a full database export before modifying any collection schema.
> Appwrite does not support rolling back attribute deletions.

---

## 1. Deprecated / Unused Fields

### 1.1 `papers` Collection

#### `marks` (integer, optional)
- **Status:** Rarely populated. No UI field in `UploadForm.tsx` for this value.
- **Safe to remove?** Yes, after confirming no documents have a meaningful `marks` value.
- **Check before removing:**
  ```
  Appwrite Console → Database → papers → Filter: marks != NULL
  ```

#### `duration` (integer, optional)
- **Status:** Rarely populated. No UI field in `UploadForm.tsx` for this value.
- **Safe to remove?** Yes, after confirming no documents have a meaningful `duration` value.
- **Check before removing:**
  ```
  Appwrite Console → Database → papers → Filter: duration != NULL
  ```

#### `uploaded_by_username` (text, optional)
- **Status:** Denormalised field. Can become stale when a user changes their username.
- **Usage:** Displayed on `PaperCard` as the uploader's name.
- **Safe to remove?** Not immediately — still used for display. Consider replacing with
  a live lookup using `uploaded_by` (the stable user ID).
- **Migration path:**
  1. Add a backend function to resolve `uploaded_by` → current username on-the-fly.
  2. Remove `uploaded_by_username` from all new document writes.
  3. Once all UI references are replaced, delete the attribute.

---

### 1.2 `syllabus` Collection

#### `uploaded_by_username` (string, optional)
- **Status:** Same denormalisation issue as `papers.uploaded_by_username`.
- **Usage:** Not currently displayed in `SyllabusClient.tsx` or `SyllabusPdfCard`.
- **Safe to remove?** Yes — it is not read anywhere in the current UI code.
- **Steps:**
  1. Search codebase: `grep -r "uploaded_by_username" src/` — confirm no active reads.
  2. In Appwrite Console, delete the `uploaded_by_username` attribute from `syllabus`.
  3. Remove from `toSyllabus()` mapper in `src/types/index.ts` if desired.

---

### 1.3 `activity_logs` Collection

#### `meta` (string/JSON, optional)
- **Status:** Rarely populated. Intended as a catch-all JSON blob but superseded by
  the `details` field (a free-text string).
- **Usage:** Not referenced in `src/app/api/admin/route.ts` or any UI component.
- **Safe to remove?** Yes, after verifying no documents rely on `meta` for display.
- **Steps:**
  1. Export the `activity_logs` collection as JSON.
  2. Check if any document has a non-null `meta` field.
  3. If all `meta` values are null or empty, delete the attribute in the console.

---

### 1.4 `users` Collection — Field Name Inconsistencies

The code maps two field names from the database:
- `display_name` (DB) → `name` (app model)
- `streak` (DB) → `streak_days` (app model)

These mappings are handled in `src/lib/auth.ts` (`getServerUser()`). They are **not
deprecated** but are documented here for maintainer awareness.

If you want to normalise the field names in the database:
1. Add new `name` and `streak_days` attributes to the `users` collection.
2. Write a migration script that copies `display_name` → `name` and
   `streak` → `streak_days` for every document.
3. Update `src/lib/auth.ts` to use the new field names.
4. Delete the old `display_name` and `streak` attributes after verifying the migration.

---

## 2. Field Addition Checklist

When adding new functionality that requires new Appwrite attributes, follow these steps:

1. **Add the attribute in Appwrite Console first.** The SDK will throw if you try to
   write a field that does not exist as a defined attribute.

2. **Set a safe default value.** For optional string attributes use `NULL`; for
   booleans use `false`; for integers use `0` where semantically appropriate.

3. **Update the TypeScript interface** in `src/types/index.ts` with the new field and
   its type.

4. **Update the mapper function** (e.g. `toSyllabus()`, `toPaper()`) to read the new
   field from the Appwrite document.

5. **Update the API route** that creates documents to include the new field.

6. **Update docs/schema.md** to document the new attribute.

---

## 3. Safe Attribute Deletion Procedure

Before deleting any attribute from an Appwrite collection:

1. **Search the codebase** for all references to the attribute name:
   ```bash
   grep -r "<attribute_name>" src/
   ```

2. **Verify no active reads.** If the attribute appears in a mapper function, UI
   component, or API route, remove those references first and deploy.

3. **Export the collection** as JSON from Appwrite Console as a backup.

4. **Delete the attribute** in Appwrite Console → Database → [Collection] → Attributes.

5. **Update `docs/schema.md`** to mark the attribute as removed.

---

## 4. Recommended Immediate Actions

| Priority | Collection      | Action                                                        |
|----------|-----------------|---------------------------------------------------------------|
| Low      | `syllabus`      | Remove `uploaded_by_username` (confirmed unused in UI)        |
| Low      | `activity_logs` | Verify `meta` is empty → remove if safe                       |
| Medium   | `papers`        | Confirm `marks` and `duration` are not populated → remove     |
| Future   | `papers` / `syllabus` | Replace `uploaded_by_username` with live user resolution |
| Future   | `users`         | Normalise `display_name` → `name`, `streak` → `streak_days`  |

---

## 5. No-Op Fields (Keep As-Is)

These fields may look redundant but serve important purposes:

| Field                      | Reason to Keep                                           |
|----------------------------|----------------------------------------------------------|
| `papers.uploaded_by`       | Stable user ID; used for permissions and attribution     |
| `papers.approved`          | Primary moderation flag queried on every browse request  |
| `syllabus.approval_status` | Enum with 3 states (pending/approved/rejected) — richer than a boolean |
| `users.role` + `primary_role` | Both exist: `role` is the legacy name, `primary_role` the v2 name; both are read in different parts of the code |
| `activity_logs.user_id` + `admin_id` | Both exist: `user_id` is indexed for efficient lookups; `admin_id` stores the acting admin |

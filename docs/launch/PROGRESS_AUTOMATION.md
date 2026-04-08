# PROGRESS_AUTOMATION.md

Automates status updates in `docs/launch/LAUNCH_CHECKLIST.md` using a single JSON source.

## Why this exists

Manual checklist edits are easy to miss or overwrite. This updater keeps status changes deterministic and reviewable in PRs.

## Inputs

Default progress file:

`docs/launch/checklist-progress.json`

Shape:

```json
{
  "items": {
    "1": "todo",
    "2": "in-progress",
    "3": "done"
  },
  "gates": {
    "Data Gate": "pending",
    "UX Gate": "pass",
    "Monetization Gate": "pending",
    "SEO Gate": "pending",
    "Ops Gate": "pending"
  }
}
```

## Command

```bash
npm run checklist:update
```

Optional custom JSON file:

```bash
node scripts/update-launch-checklist.mjs path/to/progress.json
```

## What is updated

1. Phase checklist table statuses (`todo` / `in-progress` / `done`) by row number.
2. Gate status badges (`pending` / `pass` / `fail`) under each gate section.

## Guardrails

- This automation does **not** modify ingestion templates or database schemas.
- It only edits launch checklist statuses.
- Unsupported values are ignored.

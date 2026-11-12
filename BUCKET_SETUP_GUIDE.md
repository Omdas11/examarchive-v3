# Bucket Setup Guide: Ingestion Buckets

> **Paused 2026-11-12 — do not follow as-is.** Only the `papers` bucket survives on the Free plan; the `paper-markdown` and `syllabus-files` buckets were deleted 2026-11-05. The two ingestion buckets below were never created as standalone buckets, and the code now maps ingestion data to folders inside the `papers` bucket instead. Do not create these buckets until the bucket fix is decided. The settings and automation notes below are kept for reference.

If automatic bucket creation fails (insufficient permissions), configure both ingestion buckets manually in Appwrite:

1. Open **Storage** → **Create Bucket**.
2. Create `examarchive-syllabus-md-ingestion` with:
   - Enabled: `true`
   - File Security: `false`
   - Max File Size: `2 MB`
   - Allowed Extensions: `md`
   - Compression: `none`
   - Encryption: `true`
   - Antivirus: `true`
3. Create `examarchive_question_ingest_assets` with:
   - Enabled: `true`
   - File Security: `false`
   - Max File Size: `5 MB`
   - Allowed Extensions: `md,pdf`
   - Compression: `none`
   - Encryption: `true`
   - Antivirus: `true`
4. Keep bucket permissions restricted to admin server-side operations (empty/public-disabled is fine when API key handles uploads).
5. Optional CORS (if direct browser upload is later enabled):
   - Allowed Origin: your app domain(s)
   - Allowed Methods: `GET, POST, PUT, DELETE, OPTIONS`
   - Allowed Headers: `Content-Type, Authorization, X-Appwrite-Project`

## Automation

Run:

```bash
npm run ensure:md-ingestion-bucket
```

This calls `scripts/ensure-md-ingestion-bucket.js`, which checks and creates both buckets if missing.

The same script is executed automatically by both Appwrite sync workflows before schema/function sync. That means bucket creation works in both modes:
- **Manual/mobile trigger** via **Actions → Run workflow** (`workflow_dispatch`).
- **Auto trigger** on pushes to `main` affecting sync files.

# Bucket Setup Guide: `examarchive-md-ingestion`

If automatic bucket creation fails (insufficient permissions), configure the bucket manually in Appwrite:

1. Open **Storage** → **Create Bucket**.
2. Set **Bucket ID** to `examarchive-md-ingestion`.
3. Recommended settings:
   - Enabled: `true`
   - File Security: `false`
   - Max File Size: `2 MB`
   - Allowed Extensions: `md`
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

This calls `scripts/ensure-md-ingestion-bucket.js`, which checks and creates the bucket if missing.

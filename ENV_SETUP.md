# ENV_SETUP.md — Environment Variable Reference

This document lists every environment variable used by ExamArchive v3, explains
what each one does, gives an example value, and states where it must be
configured (local development vs Vercel dashboard).

---

## Quick-start checklist

| Variable | Local `.env.local` | Vercel Dashboard |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | ✅ | ✅ |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | ✅ | ✅ |
| `NEXT_PUBLIC_APPWRITE_BUCKET_ID` | ✅ | ✅ |
| `APPWRITE_API_KEY` | ✅ | ✅ |
| `APPWRITE_BUCKET_ID` | ✅ | ✅ |
| `APPWRITE_AVATARS_BUCKET_ID` | ✅ | ✅ |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_ENABLE_DEBUG_PANEL` | optional | ❌ never |

---

## Variable reference

### `NEXT_PUBLIC_APPWRITE_ENDPOINT`

**Purpose:** The base URL of your Appwrite instance. The browser SDK uses this
to communicate with Appwrite directly (e.g. for file uploads).

**Example:**
```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
```

**Where to set:** Local `.env.local` **and** Vercel → Project Settings → Environment Variables.

---

### `NEXT_PUBLIC_APPWRITE_PROJECT_ID`

**Purpose:** Identifies your Appwrite project. Required by both the client-side
SDK and the server-side admin SDK.

**Example:**
```
NEXT_PUBLIC_APPWRITE_PROJECT_ID=6123abc456def789
```

**Where to set:** Local `.env.local` **and** Vercel dashboard.

---

### `NEXT_PUBLIC_APPWRITE_BUCKET_ID`

**Purpose:** The Appwrite Storage bucket ID used for **client-side** direct
uploads of exam paper PDFs. Must match the `APPWRITE_BUCKET_ID` value.

**Example:**
```
NEXT_PUBLIC_APPWRITE_BUCKET_ID=papers
```

**Where to set:** Local `.env.local` **and** Vercel dashboard.

---

### `APPWRITE_API_KEY`

**Purpose:** Server-side admin API key with sufficient permissions to read/write
the `papers`, `users`, `syllabus`, and `avatars` collections/buckets.
**Never expose this to the browser** — it is only used in Next.js API routes
and Server Actions.

**Example:**
```
APPWRITE_API_KEY=v1.standard.abcdef...
```

**Where to set:** Local `.env.local` **and** Vercel dashboard (mark as
_Secret_ / _Server_ scope).

---

### `APPWRITE_BUCKET_ID`

**Purpose:** The Appwrite Storage bucket ID used **server-side** for generating
download/preview URLs and for admin operations on uploaded paper PDFs.

**Example:**
```
APPWRITE_BUCKET_ID=papers
```

**Where to set:** Local `.env.local` **and** Vercel dashboard.

---

### `APPWRITE_AVATARS_BUCKET_ID`

**Purpose:** The Appwrite Storage bucket ID for user profile avatar images.
Defaults to `"avatars"` if not set.

**Example:**
```
APPWRITE_AVATARS_BUCKET_ID=avatars
```

**Where to set:** Local `.env.local` **and** Vercel dashboard.

---

### `NEXT_PUBLIC_SITE_URL`

**Purpose:** The canonical public origin of the deployed site. Used to build
absolute redirect URLs for:

- Google OAuth callback (`/auth/callback`) — Appwrite needs a full URL here.
- Magic-link emails — Appwrite embeds this URL in the email it sends.

**Example (local):**
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Example (production):**
```
NEXT_PUBLIC_SITE_URL=https://examarchive.vercel.app
```

**Where to set:** Local `.env.local` **and** Vercel dashboard.

> **Important for Google OAuth:** The value must exactly match one of the
> _Authorized redirect URIs_ configured in **Google Cloud Console** →
> APIs & Services → Credentials → your OAuth 2.0 Client ID.  
> The redirect URI to add is: `<NEXT_PUBLIC_SITE_URL>/auth/callback`  
> e.g. `https://examarchive.vercel.app/auth/callback`

---

### `NEXT_PUBLIC_ENABLE_DEBUG_PANEL`

**Purpose:** When set to `"true"` in a non-production environment, enables the
floating DebugPanel component that shows session and request diagnostics.

**Example:**
```
NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true
```

**Where to set:** Local `.env.local` only. **Never set this in production or
Vercel.**

---

## Google OAuth configuration checklist

Google authentication uses Appwrite as the OAuth intermediary. To make it work:

1. **Google Cloud Console** → APIs & Services → Credentials → your OAuth 2.0
   Client ID:
   - Add the **Authorized redirect URI**:
     ```
     https://<your-domain>/auth/callback
     ```
   - Also add `http://localhost:3000/auth/callback` for local development.

2. **Appwrite Console** → Auth → OAuth2 Providers → Google:
   - Enable Google provider.
   - Enter `GOOGLE_CLIENT_ID` (App ID) and `GOOGLE_CLIENT_SECRET` (App Secret)
     from the Google Cloud Console credentials page.

3. **Environment variables** — the Google client credentials are stored **inside
   Appwrite**, not as Next.js environment variables. You do **not** need
   `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` in your `.env.local` or Vercel
   settings for this project.

4. Ensure `NEXT_PUBLIC_SITE_URL` is set correctly in both local and Vercel
   environments (see above).

---

## Vercel-specific notes

- Set all non-`NEXT_PUBLIC_` variables with scope **Server** only (prevents
  accidental client exposure).
- `APPWRITE_API_KEY` should additionally be flagged as **Sensitive**.
- After changing any environment variable in the Vercel dashboard, trigger a
  new deployment for the changes to take effect.
- Vercel automatically sets `VERCEL_PROJECT_PRODUCTION_URL` with the production
  domain. If you rely on this instead of `NEXT_PUBLIC_SITE_URL`, make sure the
  value is accessible at build time for server-side code.

---

## Sample `.env.local`

```bash
# Appwrite – public (browser-visible)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-appwrite-project-id
NEXT_PUBLIC_APPWRITE_BUCKET_ID=papers

# Appwrite – server-only
APPWRITE_API_KEY=your-appwrite-api-key
APPWRITE_BUCKET_ID=papers
APPWRITE_AVATARS_BUCKET_ID=avatars

# Site URL (used for OAuth and magic-link redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Debug panel (development only – never set in production)
NEXT_PUBLIC_ENABLE_DEBUG_PANEL=false
```

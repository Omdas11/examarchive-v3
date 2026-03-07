# Google OAuth Setup for ExamArchive

This guide explains how to configure Google OAuth in Appwrite so that the
**"Sign in with Google"** button on the Login page works correctly.

## Prerequisites

- An [Appwrite Cloud](https://appwrite.io) project (or self-hosted ≥ 1.5)
- A [Google Cloud Console](https://console.cloud.google.com) project with OAuth 2.0 credentials
- Your ExamArchive deployment URL (e.g. `https://examarchive.vercel.app`)

---

## Step 1 — Create Google OAuth Credentials

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click **Create Credentials → OAuth client ID**.
3. Choose **Web application** as the application type.
4. Set a name, e.g. `ExamArchive`.
5. Under **Authorised redirect URIs**, add:
   ```
   https://<YOUR_APPWRITE_ENDPOINT>/v1/account/sessions/oauth2/callback/google/<YOUR_APPWRITE_PROJECT_ID>
   ```
   Replace `<YOUR_APPWRITE_ENDPOINT>` and `<YOUR_APPWRITE_PROJECT_ID>` with your values.
6. Click **Create** and copy the **Client ID** and **Client Secret**.

---

## Step 2 — Enable Google in Appwrite Console

1. In the [Appwrite Console](https://cloud.appwrite.io), open your project.
2. Go to **Auth → Settings → OAuth2 Providers**.
3. Find **Google** in the list and toggle it **On**.
4. Paste your **Client ID** and **Client Secret** from Step 1.
5. Click **Save**.

---

## Step 3 — Configure Allowed Domains

In the Appwrite Console under **Auth → Settings**:

- Add your production domain to **Allowed Domains**, e.g. `examarchive.vercel.app`.
- Add `localhost` (or your local dev URL) for local development.

---

## Step 4 — Set the Site URL Environment Variable

In your `.env.local` (and in your deployment environment):

```env
NEXT_PUBLIC_SITE_URL=https://examarchive.vercel.app
```

This is used to construct the OAuth callback redirect URL:
```
${NEXT_PUBLIC_SITE_URL}/auth/callback
```

The callback route at `src/app/auth/callback/route.ts` exchanges the
Appwrite `userId` + `secret` params for a session cookie.

---

## How It Works in the Code

| File | Role |
|------|------|
| `src/app/login/LoginForm.tsx` | Renders the "Sign in with Google" button |
| `src/app/auth/actions.ts` | `signInWithGoogle()` calls `account.createOAuth2Token(OAuthProvider.Google, ...)` and redirects the browser to Google |
| `src/app/auth/callback/route.ts` | Receives `userId` + `secret` from Appwrite, creates a session, sets the cookie, and redirects to `/` |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "OAuth provider not enabled" | Enable Google in Appwrite Console → Auth → OAuth2 |
| Redirect mismatch error (Google) | Ensure the redirect URI in Google Cloud Console exactly matches the Appwrite callback URI |
| "Domain not allowed" | Add your domain to Appwrite → Auth → Settings → Allowed Domains |
| Works locally but not in production | Set `NEXT_PUBLIC_SITE_URL` in your Vercel/deployment environment variables |

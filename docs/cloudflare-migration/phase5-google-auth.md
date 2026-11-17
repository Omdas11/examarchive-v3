# Phase 5 — Google Auth (owner steps)

> Not done yet. This phase needs the owner in the Google Cloud Console.
> Do not start it until the Cloudflare deployment is working (Phase 2 preview)
> and the data is in D1 (Phase 4). Auth lives in the app code on Workers;
> D1 has no built-in auth service.

## What is already in place

- `users` and `sessions` tables exist in D1 (migrations/0001_init.sql).
  `users.google_sub` is the stable Google user id. `sessions` stores a HASH
  of the session token, not the raw token.
- The 3 migrated users are in D1 without passwords and with
  `google_sub = NULL`. On first Google sign-in they are matched by verified
  email and get `google_sub` attached. They must sign in with Google —
  email/password hashes are not portable.
- The current site uses Appwrite Auth (email/password + Google OAuth).
  Google OAuth in the new Appwrite project was never enabled (needs the
  Client Secret from Google Cloud Console). That does not matter for
  Cloudflare — the Cloudflare app will use Google directly.

## Owner steps in the Google Cloud Console

1. Open Google Cloud Console, pick the project that owns the
   `examarchive.dev` OAuth client (or create one).
2. Go to APIs & Services → Credentials.
3. Create an OAuth 2.0 Client ID (type: Web application).
   - Name it e.g. `ExamArchive Cloudflare`.
   - Authorized JavaScript origins:
     - `https://examarchive.dev`
     - `http://localhost:3000` (dev only)
   - Authorized redirect URIs — the exact callback URL the app will use:
     - `https://examarchive.dev/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (dev only)
   - Note: if the callback path changes during the Phase 5 build, update
     the redirect URI here to match exactly, or Google will reject it.
4. OAuth consent screen:
   - Set publishing status to **In production**.
   - Scopes: only `openid`, `email`, `profile`.
   - In "Testing" mode only listed test users can sign in and tokens
     expire quickly — do not leave it in Testing.
5. Copy the Client ID and Client Secret. Store them as Worker secrets
   (never in the repo):
   - `wrangler secret put GOOGLE_CLIENT_ID`
   - `wrangler secret put GOOGLE_CLIENT_SECRET`
   - For local dev, put them in `.dev.vars` (gitignored).
6. Tell the agent the Client ID is ready (do not paste the secret in chat).

## What the agent will build after that (Phase 5, code)

- Auth library on Workers (Better Auth or Auth.js with a D1 adapter),
  or hand-rolled OIDC with the `arctic` library + the `sessions` table.
  Confirm the choice with the owner first.
- Flow: sign-in → generate `state` (+ PKCE verifier), store in a
  short-lived httpOnly cookie → redirect to Google → Google redirects to
  `/api/auth/callback/google` → validate `state`, exchange `code` for
  tokens, read ID token claims (`sub`, `email`, `email_verified`, `name`,
  `picture`). Reject if `email_verified` is false.
- Upsert user by `google_sub`; fall back to matching verified `email`
  for the 3 migrated users.
- Create a session: random 32+ byte token, store its hash in `sessions`
  with an expiry (e.g. 30 days, sliding renewal), set the cookie
  `HttpOnly; Secure; SameSite=Lax; Path=/`.
- Sign-out deletes the session row and clears the cookie.
- Admin routes check `users.role = 'admin'` server-side on every request.
- Rate-limit the auth endpoints. Do not write to D1 on every request
  just to refresh sessions — only renew when near expiry.

## What is NOT needed

- Appwrite Auth does not need to be enabled or fixed for Cloudflare.
  The Cloudflare app authenticates directly with Google.
- No new Google project is needed if an OAuth client for
  `examarchive.dev` already exists — reuse it and add the redirect URI.

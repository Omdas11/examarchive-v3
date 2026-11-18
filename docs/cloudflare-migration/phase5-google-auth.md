# Phase 5 — Google Auth (owner steps)

> **Status 2026-11-18: code built, deployed, verified as far as possible
> without the owner secrets.** The Google OAuth client + Worker secrets are
> the only remaining step (see "Owner steps still open" below). Until they
> are set, the login page shows the Google button, but clicking it lands on
> `/login?error=oauth_config` ("Google sign-in is not set up yet").
> Do not start it until the Cloudflare deployment is working (Phase 2 preview)
> and the data is in D1 (Phase 4). Auth lives in the app code on Workers;
> D1 has no built-in auth service.

## What was built (2026-11-18, commit f383753, branch migrate/cloudflare)

Hand-rolled OIDC with fetch + Web Crypto — **no new dependency** (the
`arctic` option was considered; the flow is ~100 lines and arctic would
still need the userinfo call, so hand-rolled is simpler and has zero
dependency risk on Workers). Profile claims come from Google's userinfo
endpoint with the freshly minted access token, so no ID-token signature
verification is needed.

- `src/lib/auth-cf.ts` — session layer on D1. Cookie `ea_cf_session`
  holds a random 32-byte token; only its SHA-256 hash is stored in
  `sessions.id`. 30-day sessions, expiry extended only when < 7 days
  remain (no D1 write on every request). `getServerUser()` has the same
  signature/shape as the Appwrite version and never throws (guest on any
  failure). KV rate limit for auth endpoints (10 attempts/10 min per IP,
  fail-open) on top of the WAF /api/* rule (10 req/10s).
- `src/lib/google-oauth.ts` — state + PKCE (S256), authorization URL,
  code exchange, userinfo fetch. Redirect URI is derived from the
  request origin: `https://examarchive.dev/api/auth/callback/google`
  live, `http://localhost:3000/api/auth/callback/google` in local dev.
  `safeRedirect()` allows same-site paths only (open-redirect guard).
- Routes: `GET /api/auth/google` (start), `GET
  /api/auth/callback/google` (state check → code exchange → userinfo →
  upsert → session → redirect), `POST /api/auth/signout` (delete session
  row, clear cookie, also clears the legacy Appwrite `ea_session`).
- Upsert: match by `google_sub` first; else match by verified email
  (the 3 migrated users have `google_sub = NULL`) and attach it; else
  create a new `student` (100 starting credits). Unverified Google
  emails are rejected (`oauth_unverified`). Name/avatar refresh from
  Google on every login.
- `/login` is Google-only now (magic link / password were Appwrite-only
  and did not work on Workers; they will be rebuilt after exams). The
  header (root layout) and homepage read the CF session and show the
  signed-in name/photo. Sign-out forms (sidebar, profile panel, profile
  page) POST to `/api/auth/signout`.
- Secrets are read from `process.env` at request time (same pattern as
  the Turnstile secret). Env names: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` (placeholders in `.env.example`).

Verified 2026-11-18 (deployed Worker 86709d0f):
- Live examarchive.dev: homepage/Browse/paper/search 200 as guest;
  /login 200 with the "Sign in with Google" button; /api/auth/google
  → 307 /login?error=oauth_config (no secrets yet — expected);
  callback without params → 307 /login?error=oauth_failed; sign-out
  POST → 307 /.
- Local preview with dummy credentials: /api/auth/google → 307 to
  accounts.google.com with correct client_id, redirect_uri, scope
  `openid email profile`, state, S256 code_challenge.
- Unit tests: `src/lib/google-oauth.test.ts`, 7/7 pass.
- NOT verified yet (needs owner secrets): the real Google round-trip
  (redirect to Google → approve → callback → session cookie → header
  shows the user). The owner tests this on their phone after setting
  the secrets.

## Owner steps still open

1. Finish the Google OAuth client ("ExamArchive Cloudflare") in Google
   Cloud Console (steps 1–4 below). The redirect URIs must be exactly:
   - `https://examarchive.dev/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (dev only)
   - Optional, only to test sign-in on the workers.dev preview:
     `https://examarchive.omdasg11.workers.dev/api/auth/callback/google`
     (the preview is NOT registered, so Google rejects the callback
     there with redirect_uri_mismatch until this is added).
2. Set the Worker secrets (never in chat, never in the repo):
   - `wrangler secret put GOOGLE_CLIENT_ID`
   - `wrangler secret put GOOGLE_CLIENT_SECRET`
   - For local dev, put them in `.dev.vars` (gitignored).
   No redeploy is needed after setting secrets — Workers read them live.
3. Test on your phone: open examarchive.dev, tap Sign in, tap "Sign in
   with Google", approve, and confirm the header shows your name/photo.
   (Your account omdasg11@gmail.com is one of the 3 migrated users, so
   first sign-in matches by email and attaches google_sub.)

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

> **Done 2026-11-18 (commit f383753)** — see "What was built" above.
> The checklist below is what was implemented:
>
> - ~~Auth library on Workers (Better Auth or Auth.js with a D1 adapter),
>   or hand-rolled OIDC with the `arctic` library + the `sessions` table.
>   Confirm the choice with the owner first.~~ → Chose hand-rolled OIDC
>   (fetch + Web Crypto, no new dependency).
> - Flow: sign-in → generate `state` (+ PKCE verifier), store in a
>   short-lived httpOnly cookie → redirect to Google → Google redirects to
>   `/api/auth/callback/google` → validate `state`, exchange `code` for
>   tokens, read ID token claims (`sub`, `email`, `email_verified`, `name`,
>   `picture`). Reject if `email_verified` is false. → Done; claims come
>   from the userinfo endpoint with the fresh access token.
> - Upsert user by `google_sub`; fall back to matching verified `email`
>   for the 3 migrated users. → Done.
> - Create a session: random 32+ byte token, store its hash in `sessions`
>   with an expiry (e.g. 30 days, sliding renewal), set the cookie
>   `HttpOnly; Secure; SameSite=Lax; Path=/`. → Done (renewal only when
>   < 7 days remain).
> - Sign-out deletes the session row and clears the cookie. → Done.
> - Admin routes check `users.role = 'admin'` server-side on every request.
>   → Not yet: admin pages are not ported to D1 (separate work; the CF
>   `getServerUser` returns the D1 role, so the check works once a page
>   uses it).
> - Rate-limit the auth endpoints. Do not write to D1 on every request
>   just to refresh sessions — only renew when near expiry. → Done (KV
>   cap + WAF rule; renewal only near expiry).

## What is NOT needed

- Appwrite Auth does not need to be enabled or fixed for Cloudflare.
  The Cloudflare app authenticates directly with Google.
- No new Google project is needed if an OAuth client for
  `examarchive.dev` already exists — reuse it and add the redirect URI.

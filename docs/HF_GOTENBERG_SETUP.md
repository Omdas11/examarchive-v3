# Hugging Face Gotenberg Setup (Next.js)

This guide explains how to configure PDF rendering for this Next.js app using a Hugging Face Docker Space instead of Azure-hosted Gotenberg.

## 1) Deploy your Hugging Face Space

Use a Docker Space with:

- `Dockerfile` based on `gotenberg/gotenberg:8`
- `app_port: 7860` in `README.md` frontmatter
- `PORT=7860` in container environment

Version note:

- This project is tested against Gotenberg v8 endpoint `/forms/chromium/convert/html`.
- If you change major versions, verify endpoint compatibility before rollout.
- On version upgrades, test these behaviors end-to-end:
  - HTML conversion endpoint compatibility (`/forms/chromium/convert/html`)
  - Header/footer rendering (`displayHeaderFooter=true`)
  - Wait-delay rendering behavior (`waitDelay`)
  - Successful PDF upload back into Appwrite storage

After deploy, your Space URL should look like:

`https://<username>-<space-name>.hf.space`

## 2) Configure Next.js environment variables

In local development (`.env.local`):

```bash
GOTENBERG_URL=https://<username>-<space-name>.hf.space
GOTENBERG_AUTH_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WIKIMEDIA_IMAGE_INJECTION_ENABLED=true
WIKIMEDIA_MAX_IMAGES=3
WIKIMEDIA_API_URL=https://commons.wikimedia.org/w/api.php
WIKIMEDIA_REQUEST_TIMEOUT_MS=8000
WIKIMEDIA_IMAGE_QUERY_SUFFIX=diagram
```

In production (Vercel/hosting), set:

- `GOTENBERG_URL` = your HF Space URL
- `GOTENBERG_AUTH_TOKEN` = HF token
- `WIKIMEDIA_IMAGE_INJECTION_ENABLED` = `true` to inject topic images into generated markdown
- `WIKIMEDIA_MAX_IMAGES` = max Wikimedia images per generated PDF (recommended `2-4`)
- `WIKIMEDIA_API_URL` = Wikimedia API endpoint (default `https://commons.wikimedia.org/w/api.php`)
- `WIKIMEDIA_REQUEST_TIMEOUT_MS` = timeout for Wikimedia API requests in milliseconds (default `8000`, minimum `1000`)
- `WIKIMEDIA_IMAGE_QUERY_SUFFIX` = optional text appended after a space to each heading query (for example `diagram`)

Optional hardening for AI-emitted/manual image tags:

- `FETCH_IMAGE_ALLOWED_HOSTS=upload.wikimedia.org,*.wikimedia.org,*.wikipedia.org`

Notes:

- Do not add trailing slashes (the app normalizes, but keep it clean).
- HTTPS is required.
- `GOTENBERG_URL` must point to a trusted Hugging Face Space host (`*.hf.space`).
- For private Spaces, ensure the token has permission to access the private Space.
- Wikimedia image enrichment is free and open-source (Wikimedia Commons API + assets).
- Wikimedia enrichment is opt-in: `WIKIMEDIA_IMAGE_INJECTION_ENABLED` defaults to `false`.
- The pipeline injects `[FETCH_IMAGE: ...]` tags into generated markdown first, then inlines images as base64 before Gotenberg rendering.

## 3) Verify from your Next.js app

1. Start app:
   ```bash
   npm run dev
   ```
2. Trigger Notes or Solved Paper generation from the AI content flow.
3. Confirm PDF is generated and downloadable.

## 4) Troubleshooting

- Error: `missing GOTENBERG_URL`
  - Set `GOTENBERG_URL` in environment and restart app.
- Error: `401 Unauthorized` from Gotenberg
  - Set `GOTENBERG_AUTH_TOKEN` (HF token) in your runtime environment.
  - Confirm the token can access the private Space.
- Error: `Invalid GOTENBERG_URL`
  - Ensure full URL format (`https://...hf.space`).
- Error: Gotenberg non-200 response
  - Check Space build status and logs in Hugging Face.
  - Ensure the Space is not sleeping/failing startup.
- No images in generated PDF
  - Ensure `WIKIMEDIA_IMAGE_INJECTION_ENABLED=true`.
  - Check Appwrite function logs for Wikimedia API HTTP errors/timeouts.
  - Try setting `WIKIMEDIA_IMAGE_QUERY_SUFFIX=diagram` for more visual matches.
  - Increase `WIKIMEDIA_MAX_IMAGES` only if images appear for some sections but not enough sections.
  - Confirm your Appwrite Function environment also includes the Wikimedia variables.

## 5) Keep your Space warm (every 24h)

This repository includes a scheduled workflow:

- `.github/workflows/gotenberg-keepalive.yml`

Set these repository secrets:

- `GOTENBERG_URL` (required) — your HF Space URL
- `GOTENBERG_AUTH_TOKEN` (required for private Space)

The workflow pings your Gotenberg endpoint every 24 hours and can also be run manually.

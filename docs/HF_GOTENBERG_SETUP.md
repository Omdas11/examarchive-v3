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
```

In production (Vercel/hosting), set:

- `GOTENBERG_URL` = your HF Space URL
- `GOTENBERG_AUTH_TOKEN` = HF token

Notes:

- Do not add trailing slashes (the app normalizes, but keep it clean).
- HTTPS is recommended (HTTP can be used for local/dev environments).
- For private Spaces, ensure the token has permission to access the private Space.

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

## 5) Keep your Space warm (every 24h)

This repository includes a scheduled workflow:

- `.github/workflows/gotenberg-keepalive.yml`

Set these repository secrets:

- `GOTENBERG_URL` (required) — your HF Space URL
- `GOTENBERG_AUTH_TOKEN` (required for private Space)

The workflow pings your Gotenberg endpoint every 24 hours and can also be run manually.

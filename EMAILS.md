# ExamArchive – Email Address Reference

All official ExamArchive communication must use **@examarchive.dev** addresses.

> **Note:** These addresses need to be configured with email-forwarding rules in your DNS /
> email provider before they will receive mail. See the *Setup* section below.

---

## Recommended Addresses

| Address | Purpose |
|---------|---------|
| `support@examarchive.dev` | User support, account issues, password resets |
| `admin@examarchive.dev` | Internal admin communication, ops alerts |
| `contact@examarchive.dev` | General enquiries, partnerships, press |
| `security@examarchive.dev` | Vulnerability reports, security disclosures |
| `feedback@examarchive.dev` | Product feedback and feature requests |
| `bugs@examarchive.dev` | Bug reports submitted via the support page |
| `noreply@examarchive.dev` | Transactional / automated emails (Appwrite, etc.) |

---

## Where These Addresses Are Referenced in the Codebase

| File | Address used |
|------|-------------|
| `src/app/support/page.tsx` | `contact@examarchive.dev`, `feedback@examarchive.dev`, `bugs@examarchive.dev` |
| `src/app/terms/page.tsx` | `contact@examarchive.dev` |
| `src/app/settings/SettingsForm.tsx` | `support@examarchive.dev` |

---

## Configuring Email Forwarding

### Option A – Custom domain catch-all (recommended for simplicity)

1. Log in to your DNS / domain registrar for `examarchive.dev`.
2. Add a **catch-all MX/forwarding** rule that redirects any address at
   `@examarchive.dev` to the team's real inbox (e.g. a Google Workspace group or
   a personal Gmail address used by the founder).
3. Alternatively, create individual **address aliases / forwards** for each
   address listed above.

### Option B – Google Workspace (paid)

1. Purchase a Google Workspace subscription for `examarchive.dev`.
2. Create each address as a user or alias in the Google Admin console.
3. Set up forwarding or distribution groups as needed.

### Option C – Cloudflare Email Routing (free tier)

1. Add `examarchive.dev` to Cloudflare (if not already there).
2. Navigate to **Email → Email Routing** in the Cloudflare dashboard.
3. Create forwarding rules for each address, pointing them to the destination
   inbox(es) of your choice.
4. Verify the destination email address as prompted.

---

## Appwrite Transactional Emails

If you use Appwrite's built-in email features (e.g. magic-link auth, password
reset), configure the **SMTP / email provider** in the Appwrite Console to send
from `noreply@examarchive.dev`.

Appwrite Console → **Auth → Email / SMS** → configure SMTP with your provider
(SendGrid, Mailgun, Resend, Brevo, etc.) and use `noreply@examarchive.dev` as
the sender address.

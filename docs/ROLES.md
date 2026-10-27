# ExamArchive Roles, XP & Streaks

> Canonical reference for the live system (2026-10-04; updated 2026-10-27:
> single XP-based tier ladder, verify-to-earn). Supersedes the older
> `ROLE_XO_RULEBOOK.md` v2 proposal, which described a redesign that was never
> implemented.

## Role ladder

| Level | Role | How you get it |
|-------|------|----------------|
| 0 | **Student** | Default for every new account |
| 1 | **Contributor** | Auto: ≥10 verifications + ≥100 XP + account ≥3 days old |
| 2 | **Specialist** | Auto: ≥50 verifications + ≥800 XP, no abuse flag |
| 3 | **Subject Administrator** | Assigned by a moderator/founder |
| 4 | **Moderator** | Assigned by a founder |
| 5 | **Founder** | Site owner (super-admin override) |

- `subject_admin`, `moderator`, and `founder` are **never** auto-assigned — a human
  grants them.
- There are no other roles. Legacy v1 values (`guest`, `viewer`, `visitor`,
  `explorer`, `curator`, `verified_contributor`, `admin`, `maintainer`) were
  permanently removed on 2026-10-04; any stray record still carrying one is
  treated as `student`.

## XP (experience points)

XP is earned by verifying AI content (notes, solved papers, syllabus content,
digitized paper text) — one row per (user, content); changing a verdict never
pays twice. Uploads no longer grant XP (approval still increments
`upload_count` and updates streaks).

| Action | XP | Credits |
|--------|----|---------|
| Verify AI content as correct | +10 | +1 |
| Report an error in AI content | +10 | — |
| Correction accepted by moderator | +25 | +5 |
| Reaching a 7-day streak | +100 | — |
| Reaching a 30-day streak | +500 | — |

Daily caps on verification rewards: 100 XP / 10 credits (the moderator-gated
correction bonus bypasses caps). XP thresholds feed the auto-promotion rules
above (100 XP → Contributor, 800 XP → Specialist). XP never decays.

## Streaks

- Visiting on consecutive days grows `streak_days`.
- Same-day activity is a no-op; a 2+ day gap resets the streak to 1.
- Streak milestones pay XP bonuses (see table above).
- Your avatar ring reflects your streak when your role has no ring colour:
  1–6 days blue, 7–29 days green, 30+ days animated 4-colour ring.

## Tiers

The old rank system is gone. There is one ladder, derived from XP alone
(`src/lib/roles.ts` `xpTier`, never stored as truth): **Bronze 0 → Silver 100 →
Gold 300 → Platinum 800 → Diamond 1500+**. Tiers are cosmetic (shown on your
profile, header, and sidebar) and can no longer be edited by admins.

## Custom roles (display-only)

`supporter`, `mentor`, `archivist`, `ambassador` — cosmetic badges a moderator
can attach to a profile. They grant **no permissions**.

## Permissions summary

| Capability | Student | Contributor | Specialist | Subject Admin | Moderator | Founder |
|------------|---------|-------------|------------|---------------|-----------|---------|
| Browse & download papers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload papers (pending review) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI notes / PDF generation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve/reject uploads | – | – | – | ✓ (own subjects) | ✓ | ✓ |
| Edit paper metadata | – | – | – | ✓ | ✓ | ✓ |
| Manage users & roles | – | – | – | – | ✓ | ✓ |
| Danger-zone / dev tools | – | – | – | – | – | ✓ |

## Code references

- Role definitions & helpers: `src/lib/roles.ts`
- Role type: `src/types/index.ts` (`UserRole`)
- Auto-promotion on verification: `src/lib/verify-promotion.ts` (called from `src/app/api/verify/route.ts` after each award)
- Verification ledger: `content_verifications` collection; rewards in `src/lib/verify.ts`; admin queue at `/admin/verifications`
- Streak updates: `src/lib/auth.ts` (`updateStreak`)
- Public explainer page: `/roles`

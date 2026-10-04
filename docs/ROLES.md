# ExamArchive Roles, XP & Streaks

> Canonical reference for the live system (2026-10-04). Supersedes the older
> `ROLE_XO_RULEBOOK.md` v2 proposal, which described a redesign that was never
> implemented.

## Role ladder

| Level | Role | How you get it |
|-------|------|----------------|
| 0 | **Student** | Default for every new account |
| 1 | **Contributor** | Auto: ≥2 approved uploads + ≥30 XP + account ≥3 days old |
| 2 | **Specialist** | Auto: ≥10 approved uploads + ≥150 XP |
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

XP is earned only through approved contributions:

| Action | XP |
|--------|----|
| Approved paper upload | +50 |
| First-ever approved upload (one-time bonus) | +20 |
| Reaching a 7-day streak | +100 |
| Reaching a 30-day streak | +500 |

XP thresholds feed the auto-promotion rules above (30 XP → Contributor,
150 XP → Specialist). XP never decays.

## Streaks

- Visiting on consecutive days grows `streak_days`.
- Same-day activity is a no-op; a 2+ day gap resets the streak to 1.
- Streak milestones pay XP bonuses (see table above).
- Your avatar ring reflects your streak when your role has no ring colour:
  1–6 days blue, 7–29 days green, 30+ days animated 4-colour ring.

## Tiers

Separate from roles — a standing ladder: **bronze → silver → gold → platinum → diamond**.
Currently: reaching 20 approved uploads auto-promotes bronze → silver.
Tiers are cosmetic today (shown on your profile).

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
- Auto-promotion on upload approval: `src/app/api/admin/route.ts` (`incrementUploadCount`)
- Streak updates: `src/lib/auth.ts` (`updateStreak`)
- Public explainer page: `/roles`

# ExamArchive v3 — Badge & Achievement Reference

> For the full XP system, streak logic, and implementation details see
> **[docs/XP_ACHIEVEMENTS.md](XP_ACHIEVEMENTS.md)**.
>
> Badges are **purely cosmetic** and never affect `primary_role` or permissions.

---

## Badge Types

| Type | Source | Auto-earned? | Grants Permissions? |
|------|--------|-------------|---------------------|
| **Activity-Earned** | XP, streak, upload milestones | ✅ YES | ❌ NO |
| **Role-Cosmetic** | `primary_role`, `secondary_role`, `tertiary_role` | ❌ NO — manually assigned | ❌ NO |

---

## Activity-Earned Badges

All slugs and icons match v2 `ACHIEVEMENTS.md` exactly. Icons are SVG (no emoji);
icon names refer to exports in `src/components/Icons.tsx`.

| Slug | Display Name | Icon | Trigger |
|------|-------------|------|---------|
| `first_upload` | First Upload | `upload` | `upload_count ≥ 1` |
| `10_uploads` | 10 Uploads | `trophy` | `upload_count ≥ 10` |
| `100_uploads` | 100 Uploads | `sparkles` | `upload_count ≥ 100` |
| `first_review` | First Review | `edit` | Moderator/admin with `upload_count > 0` |
| `first_publish` | First Publish | `globe` | `upload_count ≥ 1` (proxy) |
| `early_user` | Early Adopter | `star` | First 10 users (manual/future) |
| `7_day_streak` | 7-Day Streak | `fire` | `streak_days ≥ 7` |
| `30_day_streak` | 30-Day Streak | `lightning` | `streak_days ≥ 30` |
| `approval_90` | 90% Approval | `badge` | Approval ≥ 90 % and `upload_count ≥ 10` |
| `top_contributor` | Top Contributor | `medal` | `xp ≥ 800` (Veteran rank proxy) |
| `silver_tier` | Silver | `sparkles` | `tier ≥ silver` (20+ uploads, auto) |
| `gold_tier` | Gold | `trophy` | `tier ≥ gold` (admin-assigned) |

### XP Award Guide

| Event | XP |
|-------|----|
| Paper approved | +50 |
| First upload | +20 bonus |
| 7-day streak | +100 bonus |
| 30-day streak | +500 bonus |

---

## Role-Cosmetic Badges

### Primary Role Badges (shown automatically)

| Slug | Display Name | Icon | Role |
|------|-------------|------|------|
| `role_founder` | Founder | `crown` | `founder` |
| `role_admin` | Admin | `shield` | `admin` |
| `role_moderator` | Moderator | `badge` | `moderator` |

> **Note:** The `founder` role is reserved for a single user (Om Das) and
> represents the highest privilege level. It supersedes all other roles.

### Secondary / Tertiary Role Badges (community recognition)

Manually assigned by admins as `secondary_role` or `tertiary_role`. These are
display-only and **do not grant permissions**. All use the `tag` SVG icon.

| Value | Display Name | Description |
|-------|-------------|-------------|
| `contributor` | Contributor | Active paper contributor |
| `reviewer` | Reviewer | Paper quality reviewer |
| `curator` | Curator | Archive curator and organiser |
| `mentor` | Mentor | Community mentor and guide |
| `archivist` | Archivist | Specialist archivist |
| `ambassador` | Ambassador | Community ambassador |
| `pioneer` | Pioneer | Early adopter and pioneer |
| `researcher` | Researcher | Academic researcher |

---

## Avatar Ring Levels (Visual Only)

### Role-Based Ring (Priority)

| Role | Ring Style |
|------|-----------|
| `founder` | Animated purple/gold conic gradient |
| `admin` | Solid red (`#d32f2f`) |
| `moderator` | Solid orange (`#e65100`) |
| Community roles | Solid blue (`#1565c0`) |
| `student` | Streak-based (see below) |

### Streak-Based Ring (when no role ring applies)

| Streak | Ring Colour |
|--------|------------|
| 0 days | None |
| 1–6 days | Solid blue |
| 7–29 days | Solid green |
| 30+ days | Animated 4-colour Google-style ring |

---

## Badge Display Component

```tsx
import BadgeDisplay, { buildBadges } from "@/components/BadgeDisplay";

const badges = buildBadges({
  role: user.role,
  secondary_role: user.secondary_role,
  tertiary_role: user.tertiary_role,
  tier: user.tier,
  xp: user.xp,
  streak_days: user.streak_days,
  upload_count: user.upload_count,
});

// Show only earned badges:
<BadgeDisplay badges={badges} />

// Show all badges including unearned (for progress view):
<BadgeDisplay badges={badges} showAll />
```

---

## Security Notes

1. Badge display is **purely cosmetic** — permissions are determined only by `primary_role`.
2. Activity badges are derived live from user stats (no separate achievements doc required).
3. The `founder` role is a **single-user designation** — assign only to Om Das (user ID configured server-side).
4. All role assignments are validated server-side via `isValidUserRole()` and `isValidCustomRole()` in `src/lib/roles.ts`.

# ExamArchive v3 — Badge & Achievement System

> Badges are visual indicators displayed on user profiles and the admin panel.
> They are **purely cosmetic** and never grant additional permissions.

---

## 1. Two Badge Types

| Type | Source | Automatically Earned? | Grants Permissions? |
|------|--------|----------------------|---------------------|
| **Activity-Earned** | XP, streak, upload milestones | ✅ YES — auto-assigned | ❌ NO |
| **Role-Cosmetic** | Assigned `primary_role`, `secondary_role`, `tertiary_role` | ❌ NO — manually assigned | ❌ NO |

---

## 2. Activity-Earned Badges

Earned automatically when a user meets the specified threshold. Stored in the `achievements` collection (when implemented) or derived live from user stats.

| Slug | Display Name | Icon | Trigger |
|------|-------------|------|---------|
| `first_upload` | First Upload | 📄 | First paper submission approved (XP ≥ 50 or upload_count ≥ 1) |
| `10_uploads` | 10 Uploads | 📚 | 10 papers approved (upload_count ≥ 10) |
| `explorer` | Explorer | 🔭 | Reached 100 XP |
| `contributor_badge` | Contributor | 🏅 | Reached 300 XP |
| `veteran` | Veteran | 🥈 | Reached 800 XP |
| `senior` | Senior | 🥇 | Reached 1500 XP |
| `7_day_streak` | 7-Day Streak | 🔥 | 7 consecutive daily logins |
| `30_day_streak` | 30-Day Streak | ⭐ | 30 consecutive daily logins |
| `silver_tier` | Silver Tier | 🥈 | Activity tier upgraded to Silver or above |
| `gold_tier` | Gold Tier | 🥇 | Activity tier upgraded to Gold or above |

### XP Award Guide

| Event | XP Awarded |
|-------|-----------|
| Paper approved | +50 |
| First upload | +20 bonus |
| 7-day streak | +100 bonus |
| 30-day streak | +500 bonus |

---

## 3. Role-Cosmetic Badges

Assigned by admins via the User Management panel. These reflect the user's community standing or platform role.

### Primary Role Badges (Permission-Based)

These are automatically shown based on the user's `primary_role` field.

| Slug | Display Name | Icon | Role |
|------|-------------|------|------|
| `role_founder` | Founder | 👑 | `founder` |
| `role_admin` | Admin | 🛡️ | `admin` |
| `role_moderator` | Moderator | ⚖️ | `moderator` |

> **Note:** The `founder` role is reserved for a **single user (Om Das)** and represents the highest privilege level. It supersedes all other roles.

### Secondary / Tertiary Role Badges (Community Roles)

Manually assigned by admins as `secondary_role` or `tertiary_role`. These are community recognition badges and **do not grant permissions**.

| Value | Display Name | Icon | Description |
|-------|-------------|------|-------------|
| `contributor` | Contributor | 🎖️ | Active paper contributor |
| `reviewer` | Reviewer | 🎖️ | Paper quality reviewer |
| `curator` | Curator | 🎖️ | Archive curator and organiser |
| `mentor` | Mentor | 🎖️ | Community mentor and guide |
| `archivist` | Archivist | 🎖️ | Specialist archivist |
| `ambassador` | Ambassador | 🎖️ | Community ambassador |
| `pioneer` | Pioneer | 🎖️ | Early adopter and pioneer |
| `researcher` | Researcher | 🎖️ | Academic researcher |

---

## 4. Avatar Ring Levels (Visual Only)

The avatar ring colour reflects the user's **role** (takes priority) or **activity streak**.

### Role-Based Ring (Priority)

| Role | Ring Style |
|------|-----------|
| `founder` | Animated purple/gold conic gradient |
| `admin` | Solid red (`#d32f2f`) |
| `moderator` | Solid orange (`#e65100`) |
| community roles | Solid blue (`#1565c0`) |
| `student` | Streak-based (see below) |

### Streak-Based Ring (When No Role Ring)

| Streak | Ring Style |
|--------|-----------|
| 0 days | No ring |
| 1–6 days | Solid blue |
| 7–29 days | Solid green |
| 30+ days | Animated Google-style 4-color rotating ring |

---

## 5. Badge Display Component

Use `BadgeDisplay` from `src/components/BadgeDisplay.tsx`:

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

// Show all badges (earned + unearned for progress tracking):
<BadgeDisplay badges={badges} showAll />
```

---

## 6. Security Notes

1. Badge display is **purely cosmetic** — permissions are determined only by `primary_role`.
2. Activity badges are derived live from user stats (no separate `achievements` doc needed for display).
3. The `founder` role is a **single-user designation** — assign only to Om Das (user ID configured server-side).
4. All role assignments are validated server-side via `isValidUserRole()` and `isValidCustomRole()` in `src/lib/roles.ts`.

# ExamArchive v3 — Roles & Permissions

> **Golden Rule:** Permissions depend **only** on the user's `primary_role`.
> XP, streak, tier, and custom badges are cosmetic and never grant extra access.

---

## 1. Three Separate Systems

| System | Storage Field | Purpose | Grants Permissions? |
|--------|--------------|---------|---------------------|
| **Permission Role** | `primary_role` (or `role`) | Access control | ✅ YES — the ONLY source |
| **Custom Badges** | `secondary_role`, `tertiary_role` | Community display badges | ❌ NO |
| **Activity Tier** | `tier` | Gamification/cosmetic rank | ❌ NO |
| **Achievement Badges** | `achievements` collection | Auto-earned milestones | ❌ NO |
| **XP / Streak** | `xp`, `streak_days`, `last_activity` | Cosmetic progress tracking | ❌ NO |

---

## 2. Permission Role Hierarchy

| Level | Role | Dashboard | Users Tab | Approve Papers | Upload | Browse |
|-------|------|-----------|-----------|---------------|--------|--------|
| 2 | **admin** | ✅ Full | ✅ | ✅ | ✅ | ✅ |
| 1 | **moderator** | ✅ Submissions | ❌ | ✅ | ✅ | ✅ |
| 0 | **student** | ❌ | ❌ | ❌ | ✅ (pending) | ✅ |

### Access Details

- **admin**: Full admin dashboard including Users tab. Manage users, roles, and tiers. Approve/reject/publish papers.
- **moderator**: Dashboard access limited to Pending (submissions) and Activity Log tabs. Approve/reject papers. Cannot manage user roles.
- **student**: Default role for all new sign-ups. Can upload papers (subject to approval) and browse/download published papers.

Checked server-side in every protected API route using `isModerator()` / `isAdmin()` from `src/lib/roles.ts`.

---

## 3. Promotion Rules

- **Manual only** — Admins assign roles via the Admin Dashboard → Users tab or via `PATCH /api/admin/users`.
- **Admins** can assign any role (`student`, `moderator`, `admin`).
- **Moderators** cannot change roles.
- **Auto-promotion exception** — `secondary_role` is auto-set to `"contributor"` when `upload_count` reaches 3 (logic in `POST /api/admin`).
- **Tier auto-upgrade** — `tier` is auto-upgraded to `"silver"` when `upload_count` reaches 20.

---

## 4. Custom Badge Assignment (Secondary / Tertiary Roles)

Admins can assign a `secondary_role` and `tertiary_role` from the preset list below. These are display-only badges — they never affect access control.

| Value | Display Label |
|-------|--------------|
| `contributor` | Contributor |
| `reviewer` | Reviewer |
| `curator` | Curator |
| `mentor` | Mentor |

Rules:
- Only admins can manually assign secondary/tertiary roles.
- `secondary_role` may be `null` (no badge assigned).
- `secondary_role` and `tertiary_role` cannot be the same value.
- Backend validates values against the above preset list (`isValidCustomRole()` in `src/lib/roles.ts`).

---

## 5. Activity Tier System (Cosmetic)

Tiers are displayed on profile cards and badges but grant no additional permissions.

| Tier | Minimum Uploads | Auto-Assigned |
|------|----------------|---------------|
| `bronze` | 0 | Default for all new users |
| `silver` | 20 | Auto-assigned when `upload_count` reaches 20 |
| `gold` | — | Manual assignment by admin only |
| `platinum` | — | Manual assignment by admin only |
| `diamond` | — | Manual assignment by admin only |

---

## 6. XP & Streak System (Cosmetic Only)

Fields stored in the `users` collection:

| Field | Type | Description |
|-------|------|-------------|
| `xp` | integer | Cumulative experience points earned |
| `streak_days` | integer | Current consecutive daily activity streak |
| `last_activity` | ISO 8601 string | Timestamp of the user's last activity |

### XP Award Guide

| Event | XP Awarded |
|-------|-----------|
| Paper approved | +50 |
| First upload | +20 |
| 7-day streak | +100 bonus |
| 30-day streak | +500 bonus |

⚠️ XP **never** changes `primary_role` or grants permissions. XP thresholds are purely cosmetic.

### Avatar Ring Levels (Visual Only)

The avatar ring colour reflects the user's activity streak:

| Streak | Ring Colour |
|--------|------------|
| 0 days | Gray (default) |
| 1–6 days | Blue |
| 7–29 days | Green |
| 30+ days | Gold / Amber |

---

## 7. Achievement Badges (Auto-Earned)

Stored in the `achievements` collection, linked by `user_id`.

| Slug | Display Name | Trigger |
|------|-------------|---------|
| `first_upload` | First Upload | First paper submission approved |
| `10_uploads` | 10 Uploads | 10 approved submissions |
| `early_user` | Early Adopter | Among the first 50 registered users |
| `7_day_streak` | 7-Day Streak | 7 consecutive daily logins |
| `30_day_streak` | 30-Day Streak | 30 consecutive daily logins |
| `top_contributor` | Top Contributor | Highest upload count in a calendar month |

---

## 8. Database Fields Reference (users collection)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `email` | string | — | Appwrite Auth email |
| `name` | string | `""` | Display name (user-editable) |
| `username` | string | `""` | Short handle (user-editable) |
| `avatar_url` | string | `""` | URL to profile picture |
| `role` | string | `"student"` | Legacy single-role field (mirrors `primary_role`) |
| `primary_role` | string | `"student"` | Permission role |
| `secondary_role` | string \| null | `null` | Custom badge 1 |
| `tertiary_role` | string \| null | `null` | Custom badge 2 |
| `tier` | string | `"bronze"` | Activity tier |
| `upload_count` | integer | `0` | Approved upload count |
| `xp` | integer | `0` | Cumulative XP |
| `streak_days` | integer | `0` | Current streak |
| `last_activity` | string | `""` | ISO 8601 last-active timestamp |

---

## 9. Security Notes

1. **Server-side enforcement** — role checks run in Next.js API routes and server components. Frontend checks are UI-only and cannot be bypassed.
2. **Appwrite as authority** — all user data is fetched from the Appwrite database; no role data is stored in the client.
3. **httpOnly session cookie** — the `ea_session` cookie is not accessible from JavaScript; cannot be stolen via XSS.
4. **Admin API key** — server-only operations use `APPWRITE_API_KEY` (never exposed to the browser).

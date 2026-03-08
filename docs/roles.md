# ExamArchive v3 — Roles & Permissions

> **Golden Rule:** Permissions depend **only** on the user's `role` field.
> XP, streak, tier, and community badges are cosmetic and never grant extra access.
> The legacy `primary_role` field is kept for backward compatibility only — always
> read and write `role` in new code.

---

## 1. Three Separate Systems

| System | Storage Field | Purpose | Grants Permissions? |
|--------|--------------|---------|---------------------|
| **Permission Role** | `role` | Access control | ✅ YES — the ONLY source |
| **Community Badges** | `secondary_role`, `tertiary_role` | Cosmetic display badges | ❌ NO |
| **Activity Tier** | `tier` | Gamification/cosmetic rank | ❌ NO |
| **Achievement Badges** | `achievements` collection | Auto-earned milestones | ❌ NO |
| **XP / Streak** | `xp`, `streak_days`, `last_activity` | Cosmetic progress tracking | ❌ NO |

---

## 2. Expanded Role Hierarchy

Roles are ordered from least to most privileged. Each role inherits all
permissions of the roles below it.

| Level | Role | XP Threshold* | Ring Colour | Permissions |
|-------|------|--------------|-------------|-------------|
| 0 | **visitor** (`student` legacy) | 0 | None | Browse & download published papers |
| 1 | **explorer** | 50 XP | Sky blue | Browse, download, and submit papers for approval |
| 2 | **contributor** | 150 XP | Blue | Explorer + recognised contributor status |
| 3 | **verified\_contributor** | 300 XP | Indigo | Contributor + verified community standing |
| 4 | **moderator** | assigned | Orange | Approve/reject papers; dashboard (Submissions tab) |
| 5 | **maintainer** | assigned | Purple | Moderator + extended maintenance access |
| 6 | **admin** | assigned | Red | Full dashboard; manage users, roles, tiers |
| 7 | **founder** | assigned | Violet | All access including DevTool (root-level ops) |

\* XP thresholds are **eligibility hints only** — actual promotion is always
confirmed manually by an admin or founder.

### Detailed Access Matrix

| Capability | visitor | explorer | contributor | verified\_contributor | moderator | maintainer | admin | founder |
|------------|:-------:|:--------:|:-----------:|:---------------------:|:---------:|:----------:|:-----:|:-------:|
| Browse papers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download papers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload papers (pending approval) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve / reject papers | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Submissions dashboard tab | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Users dashboard tab | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assign roles | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| DevTool (root ops) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Promotion Rules

- **Manual only** — Admins/founders assign roles via the Admin Dashboard → Users
  tab or via `PATCH /api/admin/users`.
- **Admins** can assign any role up to `admin`. Only the founder can assign the
  `founder` role.
- **Moderators / maintainers** cannot change roles.
- **Auto-promotion hint** — `secondary_role` may be auto-set to `"contributor"`
  when `upload_count` reaches 3; this is cosmetic only.
- **Tier auto-upgrade** — `tier` is auto-upgraded to `"silver"` when
  `upload_count` reaches 20.

---

## 4. Community Badge Assignment (Secondary / Tertiary)

Admins can assign a `secondary_role` and `tertiary_role` from the preset list
below. These are **display-only** badges — they never affect access control.

| Value | Display Label | Description |
|-------|--------------|-------------|
| `reviewer` | Reviewer | Paper quality reviewer |
| `curator` | Curator | Archive organiser/curator |
| `mentor` | Mentor | Community mentor |
| `archivist` | Archivist | Specialist archivist |
| `ambassador` | Ambassador | Community ambassador |
| `pioneer` | Pioneer | Early adopter and pioneer |
| `researcher` | Researcher | Academic researcher |

Rules:
- Only admins/founders can manually assign community badges.
- `secondary_role` may be `null` (no badge assigned).
- `secondary_role` and `tertiary_role` cannot be the same value.
- Backend validates values against the preset list (`isValidCustomRole()` in
  `src/lib/roles.ts`).

---

## 5. Activity Tier System (Cosmetic)

Tiers are displayed on profile cards and badges but grant no additional
permissions.

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
| `streak` | integer | Current consecutive daily activity streak |
| `last_activity` | ISO 8601 string | Timestamp of the user's last activity |

### XP Award Guide

| Event | XP Awarded |
|-------|-----------|
| Paper uploaded (pending) | +10 |
| Paper approved | +50 |
| First upload | +20 bonus |
| 3rd approved paper | +30 bonus |
| Moderation action (approve/reject) | +5 |
| 7-day streak | +100 bonus |
| 30-day streak | +500 bonus |
| Community participation | +10 |

### XP Milestones (Achievements)

| Milestone | XP Threshold |
|-----------|-------------|
| Explorer eligible | 50 XP |
| Contributor eligible | 150 XP |
| Verified Contributor eligible | 300 XP |
| 500 XP badge | 500 XP |
| 1 000 XP badge | 1 000 XP |

⚠️ XP **never** changes `role` or grants permissions automatically. Admins still
confirm all role promotions manually.

---

## 7. Avatar Ring Colours (Static, Role-Based)

All rings are **static solid colours** — no gradients or animations.
Role rings take priority over streak rings.

| Role | Ring Colour | Hex |
|------|------------|-----|
| `founder` | Violet | `#7c3aed` |
| `admin` | Red | `#ef4444` |
| `maintainer` | Purple | `#a855f7` |
| `moderator` | Orange | `#f97316` |
| `verified_contributor` | Indigo | `#6366f1` |
| `contributor` | Blue | `#3b82f6` |
| `explorer` | Sky blue | `#0ea5e9` |
| `visitor` / `student` | None | — |

Streak rings (when no role ring applies):

| Streak | Ring Colour |
|--------|------------|
| 0 days | None |
| 1–6 days | Blue |
| 7–29 days | Green |
| 30+ days | Animated 4-color Google-style ring |

---

## 8. Achievement Badges (Auto-Earned)

Stored in the `achievements` collection, linked by `user_id`. See `docs/badges.md`
for full badge documentation.

| Slug | Display Name | Trigger |
|------|-------------|---------|
| `first_upload` | First Upload | First paper submission approved |
| `10_uploads` | 10 Uploads | 10 approved submissions |
| `explorer` | Explorer | 50 XP earned |
| `contributor_badge` | Contributor | 150 XP earned |
| `verified_contributor_badge` | Verified Contributor | 300 XP earned |
| `7_day_streak` | 7-Day Streak | 7 consecutive daily logins |
| `30_day_streak` | 30-Day Streak | 30 consecutive daily logins |
| `silver_tier` | Silver Tier | Tier upgraded to Silver+ |
| `gold_tier` | Gold Tier | Tier upgraded to Gold+ |

---

## 9. Database Fields Reference (users collection)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `email` | string | — | Appwrite Auth email |
| `display_name` | string | `""` | Display name (user-editable) |
| `username` | string | `""` | Short handle (user-editable) |
| `avatar_url` | string | `""` | URL to profile picture |
| `avatar_file_id` | string | `""` | Appwrite Storage file ID for avatar |
| `role` | string | `"visitor"` | **Single authoritative permission role** |
| `primary_role` | string | `"visitor"` | ⚠️ Deprecated — mirrors `role`; kept for BC |
| `secondary_role` | string \| null | `null` | Community badge 1 (cosmetic) |
| `tertiary_role` | string \| null | `null` | Community badge 2 (cosmetic) |
| `tier` | string | `"bronze"` | Activity tier |
| `upload_count` | integer | `0` | Approved upload count |
| `xp` | integer | `0` | Cumulative XP |
| `streak` | integer | `0` | Current streak |
| `last_activity` | string | `""` | ISO 8601 last-active timestamp |

---

## 10. Security Notes

1. **Server-side enforcement** — role checks run in Next.js API routes and server
   components. Frontend checks are UI-only and cannot be bypassed.
2. **Appwrite as authority** — all user data is fetched from the Appwrite database;
   no role data is stored in the client.
3. **httpOnly session cookie** — the `ea_session` cookie is not accessible from
   JavaScript; cannot be stolen via XSS.
4. **Admin API key** — server-only operations use `APPWRITE_API_KEY` (never
   exposed to the browser).
5. **Founder role** — the `isFounder()` function in `src/lib/roles.ts` is the
   authoritative check for DevTool access. It checks `role === "founder"` strictly.



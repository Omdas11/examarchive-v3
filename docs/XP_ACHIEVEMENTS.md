# ExamArchive v3 — XP, Achievements & Badge System

> All of this is **cosmetic only**. XP, streak, tier, and badges **never** affect
> `primary_role` or any permission check. See `docs/roles.md` for the permission system.

---

## 1. XP Tier System

XP is earned through platform activity (see §3 for award amounts). Tiers unlock
cosmetic rank labels and avatar ring colours.

| XP Required | Level | Title       |
|-------------|-------|-------------|
| 0           | 0     | **Visitor** |
| 100         | 5     | **Explorer** |
| 300         | 10    | **Contributor** |
| 800         | 25    | **Veteran** |
| 1 500       | 50    | **Senior** |
| 3 000       | 90    | **Elite** |
| 5 000       | 100   | **Legend** |

### XP Progress Bar (profile page)

* **Left label** — If the user has a system role (admin, moderator, founder) the
  label shows the *role name* (e.g. `20 XP · Admin`). For students the label
  shows the *XP rank title* (e.g. `80 XP · Visitor`). Matches v2
  `profile-panel.js` `xpCurrentTierEl` logic.
* **Right label** — `Next: <title> (<threshold> XP)` — hidden when the user
  has already reached Legend.

### XP Awards

| Event | XP |
|-------|----|
| Paper approved by moderator | +50 |
| First ever upload | +20 bonus |
| 7-day streak milestone reached | +100 bonus |
| 30-day streak milestone reached | +500 bonus |

XP is awarded in `POST /api/admin` (`incrementXP` helper in
`src/app/api/admin/route.ts`).

---

## 2. Daily Streak System

The streak counter tracks **consecutive days** on which the user uploaded a
paper or had a paper approved.

### Streak Logic

| Field | Location | Description |
|-------|----------|-------------|
| `streak` | `users` collection | Current streak count |
| `last_activity` | `users` collection | ISO-8601 timestamp of last activity |

A streak is considered *active* if `last_activity` is today or yesterday.
If `daysSince(last_activity) > 1` the streak resets to 0 on the next activity.

### Profile 7-Day Visualisation

Seven circles (Mon–Sun) show the current calendar week. Circles belonging to the
active streak are rendered as a filled red disc with a checkmark SVG; inactive
circles show their day number (1–7). The algorithm uses `getWeekActiveDays()` in
`src/app/profile/page.tsx`:

1. Compute today's position in the Mon–Sun week (Mon = 0 … Sun = 6).
2. If the streak is live (last\_activity today or yesterday), mark the last
   `min(streak, 7)` days ending at `last_activity` as active.

### Streak Stats Row

| Stat | Value |
|------|-------|
| **Current** | `streak_days` |
| **Best** | `streak_days` *(a separate `best_streak` field is planned but not yet in the DB schema)* |
| **Next goal** | Next value in `[7, 14, 30, 60, 100]` that exceeds the current streak |

When the streak reaches or exceeds 100 the "Next goal" shows `100` (maximum).

---

## 3. Achievement Badge System

Achievement badges are **auto-earned** based on the thresholds below. They are
displayed as compact pills on the profile page and in `BadgeDisplay.tsx`.

All slugs and icons match the v2 `ACHIEVEMENTS.md` specification exactly.

### Activity Achievements

| Slug | Label | Icon | Trigger |
|------|-------|------|---------|
| `first_upload` | First Upload | `upload` SVG | `upload_count ≥ 1` |
| `10_uploads` | 10 Uploads | `trophy` SVG | `upload_count ≥ 10` |
| `100_uploads` | 100 Uploads | `sparkles` SVG | `upload_count ≥ 100` |
| `first_review` | First Review | `edit` SVG | Moderator/admin with `upload_count > 0` (proxy) |
| `first_publish` | First Publish | `globe` SVG | `upload_count ≥ 1` (proxy: first approved paper published) |
| `early_user` | Early Adopter | `star` SVG | Among the first 10 registered users *(manual/future)* |
| `7_day_streak` | 7-Day Streak | `fire` SVG | `streak_days ≥ 7` |
| `30_day_streak` | 30-Day Streak | `lightning` SVG | `streak_days ≥ 30` |
| `approval_90` | 90% Approval | `badge` SVG | Approval rate ≥ 90 % **and** `total_uploads ≥ 10` |
| `top_contributor` | Top Contributor | `medal` SVG | `xp ≥ 800` (Veteran rank — proxy for monthly top uploader) |

> **Note on proxies** — v2 computed `first_review`/`first_publish`/`early_user`
> via Supabase RPCs with dedicated server-side tracking. In v3, these use the
> best available field approximations. Dedicated tracking can be added to the
> `users` collection later.

### Tier Milestones (v3 extension)

| Slug | Label | Icon | Trigger |
|------|-------|------|---------|
| `silver_tier` | Silver | `sparkles` SVG | `tier ≥ silver` (20+ approved uploads, auto-assigned) |
| `gold_tier` | Gold | `trophy` SVG | `tier ≥ gold` (manual admin assignment) |

### Role-Cosmetic Badges

Shown automatically based on the user's `primary_role`.

| Slug | Label | Icon | Role |
|------|-------|------|------|
| `role_founder` | Founder | `crown` SVG | `founder` |
| `role_admin` | Admin | `shield` SVG | `admin` |
| `role_moderator` | Moderator | `badge` SVG | `moderator` |

Secondary and tertiary community roles are shown as extra `tag`-icon pills.

---

## 4. SVG Icon Library (`src/components/Icons.tsx`)

All icons use **stroke-based SVGs** — no emoji anywhere in the UI. The icon
library is a direct port of v2's `js/svg-icons.js` and exports:

* **Named components** — `IconCrown`, `IconShield`, `IconFire`, `IconCheck`, …
* **`ICONS` registry** — `Record<IconName, React.FC<IconProps>>`
* **`<Icon name="…" size={16} />`** — convenience component for dynamic lookup

### Icon → v2 SVG name mapping

| `IconName` | v2 key | Used for |
|-----------|--------|----------|
| `crown` | `crown` | Founder role badge |
| `shield` | `shield` | Admin role badge |
| `lightning` | `lightning` | Senior Moderator / 30-day streak badge |
| `badge` | `badge` | Moderator / 90 % Approval badge |
| `sparkles` | `sparkles` | Contributor role / 100 Uploads badge |
| `user` | `user` | Student role pill |
| `fire` | `fire` | Daily Streak header |
| `check` | `check` | Active day circle checkmark |
| `upload` | `upload` | First Upload badge |
| `trophy` | `trophy` | 10 Uploads badge |
| `globe` | `globe` | First Publish badge |
| `star` | `star` | Early Adopter badge |
| `medal` | `medal` | Top Contributor badge |
| `edit` | `edit` | First Review badge |
| `camera` | `camera` | Avatar change button |
| `tag` | `tag` | Secondary / tertiary role pills |
| `hourglass` | `hourglass` | Legacy Member custom role |

Full list: see `src/components/Icons.tsx` for all exported names.

---

## 5. Badge Display Component

```tsx
import BadgeDisplay, { buildBadges } from "@/components/BadgeDisplay";

const badges = buildBadges({
  role:          user.role,
  secondary_role: user.secondary_role,
  tertiary_role:  user.tertiary_role,
  tier:           user.tier,
  xp:             user.xp,
  streak_days:    user.streak_days,
  upload_count:   user.upload_count,   // approved papers
  total_uploads:  totalUploads,         // all submissions (optional)
  approval_pct:   approvalPct,          // 0-100 (optional)
});

// Show only earned badges:
<BadgeDisplay badges={badges} />

// Show all badges (earned + unearned greyed-out, for progress tracking):
<BadgeDisplay badges={badges} showAll />
```

---

## 6. Avatar Ring Colours

Role rings take priority over streak rings.

### Role-Based Ring

| Role | Ring Style |
|------|-----------|
| `founder` | Animated purple/gold conic gradient |
| `admin` | Solid red (`#d32f2f`) |
| `moderator` | Solid orange (`#e65100`) |
| Community custom roles | Solid blue (`#1565c0`) |
| `student` | Streak-based (see below) |

### Streak-Based Ring (when no role ring applies)

| Streak | Ring Colour |
|--------|------------|
| 0 days | None |
| 1–6 days | Solid blue |
| 7–29 days | Solid green |
| 30+ days | Animated 4-colour Google-style rotating ring |

Implemented in `src/components/AvatarRing.tsx`.

---

## 7. Admin Table — Data Limitations

The v3 admin user table (`/admin/users`) shows:

| Column | Data source | Notes |
|--------|-------------|-------|
| Uploads | `upload_count` | Tracks **approved** papers; total submissions not stored per-user |
| Approved | `upload_count` | Same field — displayed in both columns |
| Approval % | `—` | Cannot be computed without total submissions per user |
| XP | `xp` | Accurate |
| Streak | `streak` | Accurate |

In v2, a Supabase RPC (`get_user_upload_stats`) returned `total_uploads` and
`approved_uploads` separately, enabling accurate Approval %. Adding a
`total_uploads` field to the v3 `users` collection is a planned improvement.

---

## 8. Future Enhancements

- [ ] Add `best_streak` field to `users` collection for accurate "Best" streak stat
- [ ] Add `total_uploads` field to `users` collection for accurate Approval %
- [ ] Persist `early_user` achievement at registration time
- [ ] Level-up animation (confetti + modal) when XP crosses a tier boundary, mirroring v2 `levelup.js`
- [ ] Dedicated `achievements` collection for per-user earned badges with timestamps

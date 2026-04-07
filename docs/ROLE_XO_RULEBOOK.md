# ROLE_XO_RULEBOOK.md

> **Status: Proposed v2 Spec** — This document describes a **future redesign** of the
> ExamArchive role and activity-scoring system. It does **not** reflect the current
> implementation.
>
> **Current system** (`src/lib/roles.ts`): roles are
> `visitor → explorer → contributor → verified_contributor → moderator → maintainer → admin → founder`.
> Promotions in the current system are **always confirmed manually** by an admin or founder;
> XP thresholds are informational only.
>
> See the **Mapping from Current Roles** section at the end of this document for the
> transition plan between the current and proposed systems.

---

Defines the proposed v2 ExamArchive role system, XO scoring, auto-assignment thresholds,
demotion rules, anti-abuse policies, moderation overrides, and the user appeals process.

---

## Proposed Role Hierarchy (v2)

| Level | Proposed Role | Maps to current role        | Description                                                            |
|-------|---------------|-----------------------------|------------------------------------------------------------------------|
| 0     | Guest         | visitor / student (legacy)  | Not logged in; read-only access to public pages                        |
| 1     | Viewer        | visitor / explorer          | Registered student; can browse, download, and consume AI jobs          |
| 2     | Contributor   | contributor                 | Actively uploads papers or fixes metadata; unlocks earn bonuses        |
| 3     | Curator       | verified_contributor        | Trusted data steward; can approve/reject Contributor uploads           |
| 4     | Moderator     | moderator                   | Community enforcer; can flag, hide, and escalate content               |
| 5     | Admin         | admin / founder             | Full access; can configure economy, manage roles, override any action  |

---

## XO Score — Weighted Event Table

XO (Experience & Output) score is a cumulative point value tracking user contribution quality.

| Event                                    | XO Points  | Notes                                        |
|------------------------------------------|------------|----------------------------------------------|
| Upload verified question paper            | +15        | Awarded after Curator approval               |
| Upload syllabus entry (approved)          | +20        | Awarded after Curator approval               |
| Metadata correction accepted              | +5         | Per approved correction                      |
| OCR/text correction accepted              | +3         | Per approved correction                      |
| Daily visit streak (7 consecutive days)   | +10        | Resets if streak broken                      |
| Referral: new user registers + verifies   | +20        | One-time per referred user                   |
| Browse link verified by Curator           | +5         | For valid cross-page linking contribution    |
| Upload rejected (wrong format/duplicate)  | −5         | Repeated offence doubles penalty             |
| Upload flagged as spam                    | −20        | Immediate review queue trigger               |
| Inactivity (30 days, no action)           | −10/month  | Decay applied monthly until floor reached    |

**XO score floor:** 0 (cannot go negative in display, but internal tracking continues).

---

## Auto-Assignment Thresholds

Role upgrades are evaluated automatically when XO score crosses a threshold **and** activity
conditions are met. Role upgrades require at least the stated number of approved contributions.

| Role Upgrade          | XO Score Required | Min Approved Contributions | Additional Condition                      |
|-----------------------|-------------------|----------------------------|-------------------------------------------|
| Viewer → Contributor  | ≥ 30              | ≥ 2 approved uploads       | Account at least 3 days old               |
| Contributor → Curator | ≥ 150             | ≥ 10 approved uploads      | No abuse flags in last 30 days            |
| Curator → Moderator   | ≥ 400             | ≥ 25 approved uploads      | Manual Admin review and approval required |
| Moderator → Admin     | —                 | —                          | Admin-only; manual appointment only       |

Role upgrades fire on the next system evaluation cycle (runs daily at midnight IST).

---

## Demotion Rules

| Trigger                                          | Demotion                          | Recovery Path                       |
|--------------------------------------------------|-----------------------------------|-------------------------------------|
| XO score drops below threshold for current role  | Demoted one level                 | Re-earn XO to threshold             |
| 3 uploads rejected as spam within 30 days        | Contributor → Viewer              | 14-day cooldown; then re-apply      |
| Moderator abuse flag upheld by Admin             | Moderator → Contributor           | Manual Admin review; 30-day ban     |
| Account inactive > 90 days                       | Contributor → Viewer              | Automatic; any new upload re-enables |
| Deliberate duplicate mass-upload                 | Contributor → Viewer + 30-day ban | Admin review required to lift ban   |

Demotion notifications are sent by in-app alert and logged in the audit trail.

---

## Inactivity Decay

| Inactivity Period    | XO Decay               | Role Impact                          |
|----------------------|------------------------|--------------------------------------|
| 30 days              | −10 XO                 | None unless below role threshold     |
| 60 days              | −25 XO cumulative      | May trigger demotion check           |
| 90 days              | Role demotion check    | Contributor → Viewer if below 30 XO  |
| 180 days             | Account soft-lock      | Read-only until any action taken     |

Decay is paused during documented exam periods (e.g., Nov–Dec, Apr–May).

---

## Anti-Abuse Rules

| Abuse Type                 | Detection                                                      | Action                                    |
|----------------------------|----------------------------------------------------------------|-------------------------------------------|
| Spam uploads               | > 5 uploads in 1 hour, or 3 identical PDFs                    | Auto-queue for Curator review; −20 XO    |
| Duplicate entries          | Paper code + year + college match existing active entry        | Reject with reason; −5 XO               |
| Malicious metadata edits   | Edit approved entry to remove/corrupt required fields          | Revert change; flag user; −15 XO        |
| Bot-like activity          | Rapid sequential actions from single IP within 10 minutes      | Temporary 1-hour rate limit             |
| XO farming (self-referral) | Same device/IP used for referral and referred account          | Referral bonus revoked; flag both accounts |
| Inappropriate content      | Curator or Moderator flags content as harmful                  | Immediate hide; Moderator review         |

All anti-abuse actions are logged with timestamp, user_id, action type, and resolved_by.

---

## Moderation Override Policy

A Moderator or Admin may override standard system decisions under the following conditions:

| Override Type                         | Who Can Do It    | Required Justification          | Logged   |
|---------------------------------------|------------------|---------------------------------|----------|
| Approve an otherwise-rejected upload  | Curator or above | Must note reason in audit log   | Yes      |
| Restore hidden/removed content        | Moderator or above | Approved by second Moderator or Admin | Yes  |
| Manually adjust XO score             | Admin only       | Must note reason and amount     | Yes      |
| Bypass role threshold for upgrade    | Admin only       | Exceptional contributor case    | Yes      |
| Ban user (temporary or permanent)     | Admin only       | Must note reason; notified user | Yes      |

### Audit Log Fields

Every moderation action creates a record:

```yaml
audit_id: "AUD-00123"
timestamp: "2026-04-15T14:30:00+05:30"
actor_role: "Admin"
actor_user_id: "usr-abc"
action: "xo_manual_adjust"
target_user_id: "usr-xyz"
detail: "Adjusted XO by +30 due to bulk verified syllabus submission"
```

---

## Appeals Process

A user may appeal any demotion, ban, or XO deduction through the following steps:

1. **Submit appeal:** User submits appeal via in-app form within **7 days** of the action.
   - Required fields: action being appealed, reason, supporting evidence (optional).

2. **First review:** Moderator reviews within **3 business days**.
   - If appeal is clearly valid → resolve and notify user.
   - If unclear → escalate to Admin.

3. **Admin review:** Admin reviews within **5 business days**.
   - Final decision is binding.
   - Decision logged in audit trail.

4. **Outcome notification:** User notified in-app with outcome and reasoning.

5. **Repeat appeals:** A user may not appeal the same action more than once.
   Second appeals for different actions are allowed after 30 days.

| Appeal Type                    | Max Resolution Time | Escalation Path                   |
|--------------------------------|---------------------|-----------------------------------|
| Demotion (automated)           | 3 days              | Moderator → Admin if disputed     |
| Upload rejection               | 3 days              | Curator → Moderator if disputed   |
| Account ban (temporary)        | 5 days              | Admin only                        |
| Account ban (permanent)        | 7 days              | Admin only; final                 |
| XO deduction dispute           | 3 days              | Moderator → Admin if disputed     |

---

## Mapping from Current Roles (v1 → v2)

The current system (`src/lib/roles.ts`) uses these roles and XP thresholds:

| Current Role (v1)      | XP Threshold (informational) | Proposed v2 Equivalent | Notes                                                  |
|------------------------|------------------------------|------------------------|--------------------------------------------------------|
| `visitor` / `student`  | 0                            | Guest / Viewer         | Legacy `student` alias remains at level 0              |
| `explorer`             | 50                           | Viewer                 | Renamed to Viewer in v2                                |
| `contributor`          | 150                          | Contributor            | Same function; XP → XO rename                          |
| `verified_contributor` | 300                          | Curator                | Trusted uploader; maps to Curator in v2                |
| `moderator`            | assigned                     | Moderator              | Same function                                          |
| `maintainer`           | assigned                     | (Admin tier)           | No direct v2 equivalent; fold into Admin level         |
| `admin`                | assigned                     | Admin                  | Same function                                          |
| `founder`              | assigned                     | Admin (super)          | Highest privilege; kept as distinct level in current system |

**Migration notes:**
- Current promotions are **always manually confirmed** by an admin/founder; this remains
  unchanged in the v2 proposal for roles at Curator level and above.
- The proposed auto-assignment thresholds (Viewer → Contributor → Curator) apply only
  to the lower two transitions and still require implementation work.
- Custom roles (`reviewer`, `curator`, `mentor`, `archivist`, `ambassador`, `pioneer`,
  `researcher`) in the current system are secondary/tertiary badges and are separate from
  the primary role hierarchy; they are not replaced by this v2 spec.
- `XP` (current system) and `XO` (proposed v2) are different scoring systems; a migration
  script will be needed to convert existing XP balances to starting XO scores.

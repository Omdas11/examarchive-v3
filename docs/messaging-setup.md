# ExamArchive — Messaging & Notification System: Infrastructure Preparation

This document outlines the planned architecture and setup required to support
in-app notifications and direct messaging in a future release.

---

## 1. Overview

ExamArchive will support two types of communication:

| Type             | Scope                        | Priority |
|------------------|------------------------------|----------|
| **Notifications** | System → User (1-way)       | Phase 1  |
| **Messaging**     | User ↔ User (2-way)         | Phase 2  |

---

## 2. Phase 1 — Notification System

### 2.1 Appwrite Collections Required

#### `notifications` collection

| Field          | Type                 | Required | Notes                                                   |
|----------------|----------------------|----------|---------------------------------------------------------|
| `$id`          | string (auto)        | ✅        | Appwrite auto-generated document ID                     |
| `user_id`      | string (Size: 36)    | ✅        | Recipient user ID (links to `users.$id`)                |
| `type`         | enum                 | ✅        | `paper_approved` \| `paper_rejected` \| `role_changed` \| `badge_earned` \| `announcement` |
| `title`        | string (Size: 100)   | ✅        | Short notification heading                              |
| `body`         | string (Size: 512)   | ✅        | Notification body text                                  |
| `link`         | string (Size: 512)   | —         | Optional deep-link URL (e.g. `/paper/:id`)              |
| `is_read`      | boolean              | ✅        | `false` on creation; user marks as read                 |
| `meta`         | string (Size: 1024)  | —         | Optional JSON payload (paper ID, role name, etc.)       |
| `$createdAt`   | datetime (auto)      | ✅        | Appwrite auto-timestamp                                 |

**Index:** Add an index on `user_id` + `is_read` for efficient unread-count queries.

### 2.2 Appwrite Console Setup

1. Open **Appwrite Console → Database → examarchive**.
2. Create a new collection: `notifications`.
3. Add all fields from the table above.
4. Set collection permissions:
   - Read: `role:any` (users read their own; enforced by `user_id` query filter)
   - Write: `role:any` (write only via server-side API key, not client)
5. Create an index on `user_id` (ascending).

### 2.3 API Endpoint Skeleton

Create `src/app/api/notifications/route.ts`:

```typescript
// GET  /api/notifications   → return unread notifications for current user
// POST /api/notifications   → create a notification (admin/system only)
// PATCH /api/notifications  → mark notification(s) as read
```

### 2.4 Client Hook

Create `src/hooks/useNotifications.ts`:

```typescript
// Polls every 30s or uses Appwrite Realtime subscription
// Returns: { notifications, unreadCount, markRead }
```

### 2.5 UI Integration Points

- **Navbar**: Add a bell icon with unread badge counter.
- **ProfilePanel**: Add a "Notifications" section listing recent items.
- **Toast**: Trigger toast on first render if unread notifications exist.

---

## 3. Phase 2 — Direct Messaging System

### 3.1 Appwrite Collections Required

#### `conversations` collection

| Field           | Type                 | Required | Notes                                   |
|-----------------|----------------------|----------|-----------------------------------------|
| `$id`           | string (auto)        | ✅        | Conversation ID                         |
| `participant_a` | string (Size: 36)    | ✅        | User A's Appwrite Auth ID               |
| `participant_b` | string (Size: 36)    | ✅        | User B's Appwrite Auth ID               |
| `last_message`  | string (Size: 512)   | —         | Preview of last message                 |
| `updated_at`    | datetime             | ✅        | Timestamp of last activity              |

#### `messages` collection

| Field             | Type                 | Required | Notes                                     |
|-------------------|----------------------|----------|-------------------------------------------|
| `$id`             | string (auto)        | ✅        | Message ID                                |
| `conversation_id` | string (Size: 36)    | ✅        | Links to `conversations.$id`              |
| `sender_id`       | string (Size: 36)    | ✅        | Sending user's Appwrite Auth ID           |
| `body`            | string (Size: 2048)  | ✅        | Message text (plain text only)            |
| `is_read`         | boolean              | ✅        | `false` until recipient reads it          |
| `$createdAt`      | datetime (auto)      | ✅        | Appwrite auto-timestamp                   |

**Index:** Add indexes on `conversation_id` and `sender_id`.

### 3.2 Realtime Integration

Appwrite Realtime can subscribe to collection changes:

```typescript
import { client } from "@/lib/appwrite-client";

const unsubscribe = client.subscribe(
  `databases.examarchive.collections.messages.documents`,
  (response) => {
    if (response.events.includes("databases.*.collections.*.documents.*.create")) {
      // New message received
    }
  }
);
```

---

## 4. Environment Variables

No new environment variables are required for Phase 1. Notifications are created
server-side using the existing `APPWRITE_API_KEY`.

For Phase 2 Realtime, the client-side Appwrite SDK (already configured in
`src/lib/appwrite-client.ts`) handles WebSocket connections automatically.

---

## 5. Rollout Checklist

- [ ] Create `notifications` collection in Appwrite Console
- [ ] Add indexes on `user_id` and `is_read`
- [ ] Implement `GET/POST/PATCH /api/notifications` route
- [ ] Create `useNotifications` React hook
- [ ] Add bell icon to Navbar with unread count
- [ ] Wire paper approval/rejection to create notifications
- [ ] Wire role changes (admin route) to create notifications
- [ ] Phase 2: Create `conversations` and `messages` collections
- [ ] Phase 2: Build messaging UI (inbox, conversation view)

---

## 6. References

- [Appwrite Realtime Docs](https://appwrite.io/docs/apis/realtime)
- [Appwrite Databases Docs](https://appwrite.io/docs/products/databases)
- `docs/schema.md` — full schema for all existing collections
- `src/app/api/admin/route.ts` — example of server-side DB writes

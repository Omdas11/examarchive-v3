import { adminDatabases, DATABASE_ID, COLLECTION, ID } from "./appwrite";

export interface ActivityLogEntry {
  action: string;
  target_user_id: string | null;
  target_paper_id: string | null;
  admin_id: string;
  admin_email: string;
  details: string;
}

/**
 * Write an admin/moderation action to the `activity_logs` collection.
 * Failures are silently ignored so they never block the primary operation.
 *
 * Schema note: `user_id` and `meta` are required fields in the Appwrite schema.
 * `user_id` mirrors `admin_id` for legacy compatibility.
 * `meta` is always written as an empty string — it is not used by the app.
 */
export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  try {
    const db = adminDatabases();
    await db.createDocument(
      DATABASE_ID,
      COLLECTION.activity_logs,
      ID.unique(),
      {
        ...entry,
        user_id: entry.admin_id,
        meta: "",
      },
    );
  } catch (err) {
    // activity_logs collection may not exist yet, or schema may differ
    console.warn("[activity-log] Failed to write activity log:", err);
  }
}

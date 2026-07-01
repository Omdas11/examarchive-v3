"use server";

import { adminDatabases, COLLECTION, DATABASE_ID } from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";

export async function publishSyllabusRow(id: string) {
  try {
    const user = await getServerUser();
    if (!user || (user.role !== "admin" && user.role !== "founder")) {
      return { success: false, error: "Unauthorized" };
    }

    const db = adminDatabases();
    await db.updateDocument(DATABASE_ID, COLLECTION.syllabus_table, id, {
      status: "published",
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to publish syllabus:", error);
    return { success: false, error: String(error) };
  }
}

export async function deleteSyllabusRow(id: string) {
  try {
    const user = await getServerUser();
    if (!user || (user.role !== "admin" && user.role !== "founder")) {
      return { success: false, error: "Unauthorized" };
    }

    const db = adminDatabases();
    await db.deleteDocument(DATABASE_ID, COLLECTION.syllabus_table, id);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete syllabus:", error);
    return { success: false, error: String(error) };
  }
}

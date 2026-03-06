import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  uploadAvatarToAppwrite,
  deleteAvatarFromAppwrite,
  getAvatarPreviewUrl,
  AVATARS_BUCKET_ID,
  DATABASE_ID,
  COLLECTION,
} from "@/lib/appwrite";

/**
 * POST /api/profile/avatar
 * Upload a new avatar image to Appwrite Storage (avatars bucket),
 * update the user document with the new avatar_file_id and avatar_url,
 * and delete the old avatar file if one existed.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("avatar") as File | null;
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No avatar file provided" }, { status: 400 });
  }

  // Validate: images only, max 2 MB
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or GIF images are allowed" },
      { status: 400 },
    );
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Avatar image must be 2 MB or smaller" },
      { status: 400 },
    );
  }

  try {
    // Upload new avatar to Appwrite Storage
    console.log("[api/profile/avatar] Uploading avatar for user:", user.id);
    const { fileId } = await uploadAvatarToAppwrite(file);
    console.log("[api/profile/avatar] Uploaded file with ID:", fileId);
    
    const previewUrl = getAvatarPreviewUrl(fileId);
    console.log("[api/profile/avatar] Generated preview URL:", previewUrl);

    const db = adminDatabases();

    // Fetch old avatar_file_id to clean up
    let oldFileId: string | null = null;
    try {
      const doc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      oldFileId = (doc.avatar_file_id as string) ?? null;
      console.log("[api/profile/avatar] Found existing avatar_file_id:", oldFileId);
    } catch {
      // Document may not have avatar_file_id field yet
      console.log("[api/profile/avatar] No existing avatar found or field missing");
    }

    // Update user document with new fileId and preview URL
    console.log("[api/profile/avatar] Updating user document with new avatar data");
    await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
      avatar_file_id: fileId,
      avatar_url: previewUrl,
    });
    console.log("[api/profile/avatar] User document updated successfully");

    // Delete old avatar file after successful update
    if (oldFileId) {
      try {
        await deleteAvatarFromAppwrite(oldFileId);
        console.log("[api/profile/avatar] Deleted old avatar file:", oldFileId);
      } catch (delErr) {
        // Non-fatal: file may have already been deleted
        console.warn("[api/profile/avatar] Failed to delete old avatar:", delErr);
      }
    }

    return NextResponse.json({
      avatar_file_id: fileId,
      avatar_url: previewUrl,
      bucket_id: AVATARS_BUCKET_ID,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile/avatar] Upload failed:", errorMessage, err);
    return NextResponse.json(
      { error: "Avatar upload failed", details: errorMessage },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove the user's current avatar, reset avatar_url to empty string.
 */
export async function DELETE() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = adminDatabases();
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
    const oldFileId = (doc.avatar_file_id as string) ?? null;

    // Clear the avatar fields
    await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
      avatar_file_id: null,
      avatar_url: "",
    });

    if (oldFileId) {
      try {
        await deleteAvatarFromAppwrite(oldFileId);
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[api/profile/avatar] Delete failed:", err);
    return NextResponse.json(
      { error: "Failed to remove avatar" },
      { status: 500 },
    );
  }
}

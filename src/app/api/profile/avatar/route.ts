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
    // Upload new avatar
    const { fileId } = await uploadAvatarToAppwrite(file);
    const previewUrl = getAvatarPreviewUrl(fileId);

    const db = adminDatabases();

    // Fetch old avatar_file_id to clean up
    let oldFileId: string | null = null;
    try {
      const doc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      oldFileId = (doc.avatar_file_id as string) ?? null;
    } catch {
      // document may not have avatar_file_id field yet
    }

    // Update user document with new fileId and preview URL
    await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
      avatar_file_id: fileId,
      avatar_url: previewUrl,
    });

    // Delete old avatar file after successful update
    if (oldFileId) {
      try {
        await deleteAvatarFromAppwrite(oldFileId);
      } catch {
        // Non-fatal: file may have already been deleted
      }
    }

    return NextResponse.json({
      avatar_file_id: fileId,
      avatar_url: previewUrl,
      bucket_id: AVATARS_BUCKET_ID,
    });
  } catch (err: unknown) {
    console.error("[api/profile/avatar] Upload failed:", err);
    return NextResponse.json(
      { error: "Avatar upload failed" },
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

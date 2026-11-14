import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";

const SITE = "https://examarchive.dev";

/** Unlink the Discord account from the logged-in user's profile. */
export async function POST() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/profile", SITE));
  }

  try {
    await adminDatabases().updateDocument(
      DATABASE_ID,
      COLLECTION.users,
      user.id,
      {
        discord_id: null,
        discord_username: null,
        discord_avatar: null,
        discord_in_server: false,
      },
    );
  } catch (err) {
    console.error("[discord-oauth] unlink failed", err);
    return NextResponse.redirect(new URL("/profile?discord=error", SITE));
  }

  return NextResponse.redirect(new URL("/profile?discord=unlinked", SITE));
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section
      className="mx-auto px-4 py-10"
      style={{ maxWidth: "var(--max-w)" }}
    >
      <h1 className="text-2xl font-bold">Your Profile</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Account details and settings.
      </p>

      <div className="card mt-6 p-6 space-y-4">
        {/* Avatar placeholder */}
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-black text-white"
            style={{ background: "var(--color-primary)" }}
          >
            {user.email.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-semibold">{user.email}</p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Member since {joinedDate}
            </p>
          </div>
        </div>

        <hr style={{ borderColor: "var(--color-border)" }} />

        {/* Profile details */}
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>Role</dt>
            <dd className="capitalize font-medium">{user.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>User ID</dt>
            <dd
              className="font-mono text-xs truncate max-w-[200px]"
              title={user.id}
            >
              {user.id}
            </dd>
          </div>
        </dl>

        <hr style={{ borderColor: "var(--color-border)" }} />

        {/* Sign out */}
        <form action={signOut}>
          <button type="submit" className="btn text-sm px-4 py-2">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}

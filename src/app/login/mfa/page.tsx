import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { MFA_PENDING_COOKIE, decodeMfaPending } from "@/lib/mfa";
import MfaChallengeForm from "./MfaChallengeForm";

export const metadata: Metadata = {
  title: "Two-Factor Authentication",
  description: "Enter the code from your authenticator app to finish signing in.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function MfaLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  // No pending challenge (expired, completed, or direct visit) -> back to login.
  const cookieStore = await cookies();
  const pending = decodeMfaPending(cookieStore.get(MFA_PENDING_COOKIE)?.value);
  if (!pending || Date.parse(pending.expiresAt) <= Date.now()) {
    redirect("/login?error=mfa_session_expired");
  }

  const errorText = error
    ? error === "mfa_session_expired"
      ? "Your sign-in session expired. Please sign in again."
      : decodeURIComponent(error)
    : null;

  return (
    <MainLayout
      title="Two-Factor Authentication"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Sign In", href: "/login" }, { label: "Two-Factor Authentication" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole="student"
      isLoggedIn={false}
      userName=""
      userInitials=""
    >
      <div className="mx-auto flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="card p-8">
            <div className="mb-6 text-center">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-base font-black text-white"
                style={{ background: "var(--color-primary)" }}
              >
                EA
              </span>
              <h1 className="mt-3 text-xl font-bold">Two-factor authentication</h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                Your account has two-factor authentication turned on.
              </p>
            </div>

            <MfaChallengeForm factor={pending.factor} errorText={errorText} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

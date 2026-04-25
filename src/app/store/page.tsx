import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { getServerUser } from "@/lib/auth";
import { CREDIT_PACKS, PASSES } from "@/lib/payments";
import StoreClient from "./StoreClient";

export const metadata: Metadata = {
  title: "Store",
  description: "Top up electron credits via Razorpay.",
  robots: { index: false, follow: false },
};

export default async function StorePage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/store");
  const userName = user.name || user.username || "User";

  return (
    <MainLayout
      title="Store"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Store" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userName.substring(0, 2).toUpperCase()}
    >
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <StoreClient packs={CREDIT_PACKS.map((p) => ({ ...p }))} passes={PASSES.map((p) => ({ ...p }))} currentCredits={user.ai_credits ?? 0} />
    </MainLayout>
  );
}

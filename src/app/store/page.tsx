import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { CREDIT_PACKS, PASSES } from "@/lib/payments";
import { getProductsWithLivePricing, buildAffiliateLink } from "@/lib/amazon-products";
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

  // ── Determine first-time buyer status ───────────────────────────────────
  // A user is a first-time buyer when they have no completed (credits_applied)
  // purchase records.  Checked server-side so it cannot be spoofed by the client.
  let isFirstTimeBuyer = false;
  try {
    const db = adminDatabases();
    const { total } = await db.listDocuments(DATABASE_ID, COLLECTION.purchases, [
      Query.equal("user_id", user.id),
      Query.equal("credits_applied", true),
      Query.limit(1),
    ]);
    isFirstTimeBuyer = total === 0;
  } catch {
    // If the check fails (e.g. collection doesn't exist yet) default to no discount
    isFirstTimeBuyer = false;
  }

  // ── Fetch Amazon affiliate products ─────────────────────────────────────
  const rawProducts = await getProductsWithLivePricing();
  const amazonProducts = rawProducts.map((p) => ({
    asin: p.asin,
    title: p.title,
    category: p.category,
    priceInPaise: p.livePriceInPaise ?? p.staticPriceInPaise,
    isLivePrice: p.livePriceInPaise !== undefined,
    thumbnailUrl: p.thumbnailUrl,
    buyUrl: buildAffiliateLink(p.asin),
  }));

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
      <StoreClient
        packs={CREDIT_PACKS.map((p) => ({ ...p }))}
        passes={PASSES.map((p) => ({ ...p }))}
        currentCredits={user.ai_credits ?? 0}
        isFirstTimeBuyer={isFirstTimeBuyer}
        amazonProducts={amazonProducts}
      />
    </MainLayout>
  );
}

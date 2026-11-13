import type { Metadata } from "next";
import Script from "next/script";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { STORE_COMING_SOON } from "@/lib/economy";
import { CREDIT_PACKS, PASSES } from "@/lib/payments";
import Link from "next/link";
import { getProductsWithLivePricing, buildAffiliateLink } from "@/lib/amazon-products";
import StoreClient from "./StoreClient";

export const metadata: Metadata = {
  title: "Store",
  description: "ExamArchive store — credit top-ups and passes.",
  robots: { index: false, follow: false },
};

export default async function StorePage() {
  const user = await getServerUser();
  const displayName = user?.name || user?.username || "Guest";

  // ── Store closed for now: show the closed notice (public, no data fetching).
  // Flip STORE_COMING_SOON in lib/economy.ts to reopen the store.
  if (STORE_COMING_SOON) {
    return (
      <MainLayout
        title="Store"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Store" }]}
        showSearch={false}
        sidebarItems={APP_SIDEBAR_ITEMS}
        userRole={user?.role ?? "student"}
        isLoggedIn={!!user}
        userName={displayName}
        userInitials={displayName.substring(0, 2).toUpperCase()}
      >
        <section className="mx-auto px-4 py-16 text-center" style={{ maxWidth: "var(--max-w)" }}>
          <span
            className="material-symbols-outlined mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ background: "var(--brand-emerald-soft)", color: "var(--brand-emerald-dark)" }}
            aria-hidden="true"
          >
            storefront
          </span>
          <h1 className="mt-5 text-2xl font-bold text-on-surface">Store</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
            Credit top-ups and passes aren&apos;t available right now. Everything in the
            archive stays free to browse.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/browse" className="btn-primary text-sm px-6 py-2.5 rounded-full">
              Browse the Archive
            </Link>
            <Link
              href="/dashboard"
              className="bg-surface text-on-surface border border-outline-variant/20 font-bold text-sm px-6 py-2.5 rounded-full hover:bg-surface-container-low transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      </MainLayout>
    );
  }

  if (!user) redirect("/login?next=/store");
  const userName = user.name || user.username || "User";

  // ── Determine first-time buyer status ───────────────────────────────────
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

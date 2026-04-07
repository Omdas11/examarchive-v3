import type { Metadata } from "next";
import { getServerUser } from "@/lib/auth";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Buy AI credits, semester passes, and premium study bundles on ExamArchive.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop | ExamArchive",
    description:
      "Digital products for students: AI credits, semester passes, and premium study bundles.",
    url: "https://www.examarchive.dev/shop",
    type: "website",
  },
};

const products = [
  { name: "AI PDF (Short)", price: "₹9-19", credits: "9-19 credits" },
  { name: "Solved Paper Generation", price: "₹19-39", credits: "19-39 credits" },
  { name: "Premium Typed Notes", price: "₹29-79", credits: "29-79 credits" },
  { name: "Semester Pass (6 months)", price: "₹299-499", credits: "pass entitlement" },
];

export default async function ShopPage() {
  const user = await getServerUser();
  const userName = user ? (user.name || user.username || "Scholar") : "";
  const userInitials = userName ? userName.slice(0, 2).toUpperCase() : "";

  return (
    <MainLayout
      title="Shop"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user?.role ?? "visitor"}
      isLoggedIn={!!user}
      userName={userName}
      userInitials={userInitials}
    >
      <section className="mx-auto px-4 py-10 space-y-6" style={{ maxWidth: "var(--max-w)" }}>
        <div className="card p-6">
          <h1 className="text-2xl font-bold">ExamArchive Shop</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Digital-only products to sustain the platform. Payment gateway is not enabled yet; launch flow is manual UPI verification.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((product) => (
            <article key={product.name} className="card p-5">
              <h2 className="text-base font-semibold">{product.name}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">Suggested pricing: {product.price}</p>
              <p className="mt-1 text-xs text-on-surface-variant">Credit model: {product.credits}</p>
              <a
                href={`mailto:contact@examarchive.dev?subject=${encodeURIComponent(`Shop interest: ${product.name}`)}`}
                className="inline-flex mt-4 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
              >
                Request Access
              </a>
            </article>
          ))}
        </div>
      </section>
    </MainLayout>
  );
}

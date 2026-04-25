# Amazon Affiliate Products — Setup Guide

This guide explains how to configure the **Study Materials** section that appears
on the ExamArchive Store page.  The section shows curated Amazon products with
thumbnails, pricing, and "Buy from Amazon" links that include your affiliate tag.

---

## 1. Join Amazon Associates (India)

1. Go to **[https://affiliate-program.amazon.in](https://affiliate-program.amazon.in)** and sign in with your
   Amazon account.
2. Complete the application — provide your website URL (`https://examarchive.dev`
   or your production domain), describe your audience, and submit.
3. Amazon typically approves or rejects applications within **1–3 business days**.
4. Once approved, note your **Affiliate Tag** (also called *Partner Tag* or
   *Tracking ID*).  It looks like `examarchive-21`.

---

## 2. Add Your Affiliate Tag (minimum required step)

Open your Vercel (or local `.env`) environment and set:

```env
AMAZON_AFFILIATE_TAG=examarchive-21
```

That's all you need for the basic section.  Every product card will link to
`https://www.amazon.in/dp/{ASIN}?tag=examarchive-21` and the commission counter
will start once customers click through and purchase.

---

## 3. Enable Live Pricing and Thumbnails via PA API (optional)

The **Product Advertising API v5 (PA API)** allows fetching real-time prices and
official thumbnail images straight from Amazon.  Without it the section uses
static fallback prices defined in `src/lib/amazon-products.ts`.

### 3.1 Generate PA API credentials

> **Requirement:** You must have made at least **three qualifying sales** through
> your affiliate links before Amazon activates PA API access.

1. Log into [Associates Central](https://affiliate-program.amazon.in) →
   **Tools** → **Product Advertising API**.
2. Click **Join** (only visible after three qualifying sales).
3. Under **Manage your credentials**, click **Add credentials**.
4. Copy the **Access Key** and **Secret Key** shown once (you cannot retrieve
   the secret key again).

### 3.2 Set the environment variables

```env
AMAZON_AFFILIATE_TAG=examarchive-21
AMAZON_PA_API_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
AMAZON_PA_API_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AMAZON_PA_API_MARKETPLACE=www.amazon.in
```

| Variable | Description | Default |
|---|---|---|
| `AMAZON_AFFILIATE_TAG` | Your Associates partner tag | *(none)* |
| `AMAZON_PA_API_ACCESS_KEY` | PA API access key | *(none)* |
| `AMAZON_PA_API_SECRET_KEY` | PA API secret key | *(none)* |
| `AMAZON_PA_API_MARKETPLACE` | Amazon marketplace host | `www.amazon.in` |

In **Vercel**: go to your project → **Settings** → **Environment Variables**
and add all four.  Redeploy after saving.

### 3.3 Verify live pricing is active

After deploying, visit the Store page as a logged-in user.  Products fetched
via PA API show a green **Live** badge next to the price.  If you see no badge
the fallback static price is being used (check server logs for errors).

---

## 4. Updating the Product Catalogue

The curated product list lives in:

```
src/lib/amazon-products.ts  →  STATIC_AMAZON_PRODUCTS
```

Each entry has this shape:

```ts
{
  asin: "B07DFBS5D7",                   // Amazon product ASIN
  title: "Casio FX-991EX ClassWiz…",   // Display name
  category: "Calculator",               // Shown above the title
  staticPriceInPaise: 189900,           // Fallback price in paise (₹1899 = 189900)
  thumbnailUrl: "https://…",            // Fallback image (from Amazon CDN)
}
```

### 4.1 Finding ASINs

The ASIN is the 10-character product identifier in any Amazon.in URL:

```
https://www.amazon.in/dp/B07DFBS5D7    →  ASIN = B07DFBS5D7
```

### 4.2 Finding static thumbnail URLs (without PA API)

1. Open the product page on Amazon.in.
2. Right-click the main product image → **Open image in new tab**.
3. Copy the URL and paste it as `thumbnailUrl`.  Trim any size suffixes
   (e.g. `_SL1500_`) and replace with `_SL200_` for a 200 px thumbnail.

Example:
```
https://m.media-amazon.com/images/I/71e4b…._SL200_.jpg
```

When PA API is configured, the `thumbnailUrl` field in `STATIC_AMAZON_PRODUCTS`
is only used as a fallback.  PA API provides the official URL automatically.

### 4.3 Adding or removing products

Edit `STATIC_AMAZON_PRODUCTS` in `src/lib/amazon-products.ts`.  Add a new
object to the array or delete an existing one, then redeploy.

---

## 5. Compliance notes

- **Disclose the affiliate relationship.** The Store page already includes the
  disclosure *"ExamArchive may earn a small commission from qualifying purchases
  at no extra cost to you."* Keep this visible whenever affiliate links appear.
- **Do not modify prices** shown to users — always display the price returned by
  Amazon (via PA API) or an honest static estimate.  Never artificially inflate
  the Amazon price.
- **PA API terms** prohibit caching prices for more than 24 hours.  The route
  (`/api/amazon-products`) is set to `revalidate = 3600` (1 hour) which is
  within the allowed window.

---

## 6. Architecture overview

| File | Role |
|---|---|
| `src/lib/amazon-products.ts` | Product catalogue, PA API signing, `getProductsWithLivePricing()` |
| `src/app/api/amazon-products/route.ts` | Public GET endpoint; cached 1 h |
| `src/app/store/page.tsx` | Calls `getProductsWithLivePricing()` at render; passes data to StoreClient |
| `src/app/store/StoreClient.tsx` | Renders the "Study Materials" grid |

The store page fetches products **server-side** so there is no client-side
waterfall — the section renders on first load even without JavaScript.

---

*Last updated: 2026-04*

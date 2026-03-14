import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import RightColumn from "@/components/RightColumn";
import { getServerUser } from "@/lib/auth";
import DebugPanel from "@/components/DebugPanel";
import { ToastProvider } from "@/components/ToastContext";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import CourseSetupWrapper from "@/components/CourseSetupWrapper";
import AIBubble from "@/components/AIBubble";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://examarchive.dev";
const SITE_NAME = "ExamArchive";
const SITE_DESCRIPTION =
  "Browse, download, and contribute past exam question papers and syllabi for Haflong Government College, Assam University, Gauhati University, and more. Free, community-driven academic archive for FYUGP and CBCS students.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "ExamArchive",
    "exam papers",
    "past papers",
    "question papers",
    "syllabus",
    "Haflong Government College",
    "Assam University",
    "Gauhati University",
    "FYUGP",
    "CBCS",
    "NEP",
    "free exam papers",
    "study materials",
    "AI study summary",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} – Free Past Exam Papers & Syllabi`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "ExamArchive – past exam papers for students",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} – Free Past Exam Papers & Syllabi`,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

/** JSON-LD structured data (WebSite schema). */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/browse?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="ExamArchive" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ExamArchive" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#4f46e5" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/branding/logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}var rm=localStorage.getItem("reduceMotion");if(rm==="true"){document.documentElement.setAttribute("data-reduce-motion","true")}}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js")});}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <ToastProvider>
            <Navbar user={user} />
            <div className="dashboard-grid flex-1">
              <Sidebar user={user} />
              <main className="main-content flex-1 has-bottom-nav animate-page-in">
                {children}
                <Footer />
              </main>
              <RightColumn user={user} />
            </div>
            <BottomNav />
            <PWAInstallPrompt />
            <CourseSetupWrapper isLoggedIn={!!user} />
            <AIBubble isLoggedIn={!!user} />
            {process.env.NODE_ENV !== "production" &&
              process.env.NEXT_PUBLIC_ENABLE_DEBUG_PANEL === "true" && (
                <DebugPanel />
              )}
          </ToastProvider>
        </div>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}

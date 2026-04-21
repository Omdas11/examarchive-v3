import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getServerUser } from "@/lib/auth";
import DebugPanel from "@/components/DebugPanel";
import { ToastProvider } from "@/components/ToastContext";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import CourseSetupWrapper from "@/components/CourseSetupWrapper";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import SimpleAnalytics from "@/components/SimpleAnalytics";

const SITE_URL = "https://www.examarchive.dev";
const OG_IMAGE_URL = `${SITE_URL}/branding/logo.png`;
const SITE_NAME = "ExamArchive";
const SITE_DESCRIPTION =
  "Browse, download, and contribute past exam papers and syllabi. Free community-driven archive for FYUGP students — starting with Haflong Government College.";
const THEME_INIT_SCRIPT =
  '(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.setAttribute("data-theme","dark")}var rm=localStorage.getItem("reduceMotion");if(rm==="true"){document.documentElement.setAttribute("data-reduce-motion","true")}}catch(e){}})();';
const SERVICE_WORKER_SCRIPT =
  'if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js")});}';

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
        url: OG_IMAGE_URL,
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
    images: [OG_IMAGE_URL],
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
  alternateName: ["Exam Archive", "examarchive"],
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
        {/* Preconnect for Google Fonts performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter – Stitch design spec: Inter font throughout the UI */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        {/* Material Symbols Outlined – used by Stitch/Indigo dashboard components */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
        <script>{THEME_INIT_SCRIPT}</script>
        <script>{SERVICE_WORKER_SCRIPT}</script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <ToastProvider>
            <AppShell user={user}>
              {children}
            </AppShell>
            <PWAInstallPrompt />
            <CourseSetupWrapper isLoggedIn={!!user} />
            {process.env.NODE_ENV !== "production" &&
              process.env.NEXT_PUBLIC_ENABLE_DEBUG_PANEL === "true" && (
                <DebugPanel />
              )}
          </ToastProvider>
        </div>
        <SpeedInsights />
        <Analytics />
        <SimpleAnalytics />
        <GoogleAnalytics />
      </body>
    </html>
  );
}

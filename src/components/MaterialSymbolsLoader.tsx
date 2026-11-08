"use client";

import { useEffect } from "react";

const MATERIAL_SYMBOLS_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap";

/**
 * Loads the Material Symbols stylesheet (used by Stitch/Indigo dashboard
 * components) after hydration, so the Google Fonts CSS is not render-blocking
 * on first paint. A plain <link> in the root layout cannot use onLoad (event
 * handlers are not allowed in Server Components), so the link is injected
 * imperatively instead. With JavaScript off, the <noscript> fallback in
 * layout.tsx covers it.
 */
export default function MaterialSymbolsLoader() {
  useEffect(() => {
    if (document.querySelector(`link[href="${MATERIAL_SYMBOLS_URL}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MATERIAL_SYMBOLS_URL;
    document.head.appendChild(link);
  }, []);
  return null;
}

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared theme state (light/dark). Reads the saved preference from
 * localStorage, falls back to the OS preference, and persists changes.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setIsDark(saved === "dark");
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const current = document.documentElement.getAttribute("data-theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = current === "dark" || (!current && prefersDark);
      setIsDark(dark);
      if (!current) document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    }
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      const theme = next ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
      return next;
    });
  }, []);

  return { isDark, toggle, ready };
}

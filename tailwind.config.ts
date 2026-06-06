import type { Config } from "tailwindcss";
import type { PluginAPI } from "tailwindcss/types/config";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Stitch design spec: Plus Jakarta Sans throughout the UI
        sans: ["var(--font-jakarta)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Legacy support
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Academic Vitality - Primary (Emerald Green)
        primary: "rgb(var(--rgb-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--rgb-primary-container) / <alpha-value>)",
        "on-primary": "#ffffff",
        "on-primary-container": "#00422b",
        "primary-fixed": "rgb(var(--rgb-primary-fixed) / <alpha-value>)",
        "primary-fixed-dim": "rgb(var(--rgb-primary-fixed-dim) / <alpha-value>)",
        "on-primary-fixed": "#002113",
        "on-primary-fixed-variant": "#005236",

        // Academic Vitality - Secondary (Blue)
        secondary: "rgb(var(--rgb-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--rgb-secondary-container) / <alpha-value>)",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#001d35",
        "secondary-fixed": "#d8e2ff",
        "secondary-fixed-dim": "#adc6ff",
        "on-secondary-fixed": "#001a42",
        "on-secondary-fixed-variant": "#004395",

        // Academic Vitality - Tertiary (Amber/Gold)
        tertiary: "#855300",
        "tertiary-container": "#e29100",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#523200",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "on-tertiary-fixed-variant": "#653e00",

        // Surface & Background
        surface: "rgb(var(--rgb-surface) / <alpha-value>)",
        "surface-dim": "rgb(var(--rgb-surface-dim) / <alpha-value>)",
        "surface-bright": "rgb(var(--rgb-surface) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--rgb-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--rgb-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--rgb-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--rgb-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--rgb-surface-container-highest) / <alpha-value>)",
        "surface-variant": "rgb(var(--rgb-surface-variant) / <alpha-value>)",
        "on-surface": "rgb(var(--rgb-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--rgb-on-surface-variant) / <alpha-value>)",

        // Error & Status
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Outline & Borders
        outline: "rgb(var(--rgb-outline-variant) / <alpha-value>)",
        "outline-variant": "rgb(var(--rgb-outline-variant) / <alpha-value>)",

        // Background & Inverse
        "on-background": "rgb(var(--rgb-on-surface) / <alpha-value>)",
        "inverse-surface": "rgb(var(--rgb-inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "rgb(var(--rgb-inverse-on-surface) / <alpha-value>)",
        "inverse-primary": "rgb(var(--rgb-inverse-primary) / <alpha-value>)",

        // Tint
        "surface-tint": "rgb(var(--rgb-primary) / <alpha-value>)",
      },
      spacing: {
        xs: "0.25rem",     // 4px
        sm: "0.75rem",     // 12px
        md: "1.5rem",      // 24px
        lg: "2.5rem",      // 40px
        xl: "4rem",        // 64px
        "2xl": "6rem",     // 96px
      },
      borderRadius: {
        sm: "0.5rem",      // 8px
        md: "1rem",        // 16px
        lg: "1.5rem",      // 24px
        xl: "2rem",        // 32px
        "2xl": "3rem",     // 48px
        full: "9999px",
      },
      fontSize: {
        xs: ["0.6875rem", { lineHeight: "1rem" }],   // 11px
        sm: ["0.75rem", { lineHeight: "1rem" }],     // 12px
        base: ["0.875rem", { lineHeight: "1.25rem" }], // 14px - body-md
        lg: ["1rem", { lineHeight: "1.5rem" }],      // 16px - body-lg
        xl: ["1.375rem", { lineHeight: "1.75rem" }], // 22px - title-lg
        "2xl": ["2rem", { lineHeight: "2.5rem" }],   // 32px - headline-lg
        "3xl": ["3.5625rem", { lineHeight: "4rem" }], // 57px - display-lg
      },
      boxShadow: {
        // Ambient shadow for floating elements (Academic Vitality spec)
        ambient: "0 4px 20px rgba(17, 24, 39, 0.05)",
        // Tonal lift (used for cards on tonal backgrounds)
        lift: "0 8px 30px rgba(17, 24, 39, 0.10)",
        // Floating shadow
        floating: "0 12px 40px rgba(16, 185, 129, 0.15)",
        // Subtle focus state
        focus: "0 0 0 3px rgba(16, 185, 129, 0.2)",
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scroll-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "page-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "scroll-in": "scroll-in 0.4s ease-out",
        "page-in": "page-in 0.3s ease-out",
      },
    },
  },
  plugins: [
    function (api: PluginAPI) {
      api.addUtilities({
        ".glass": {
          "@apply bg-surface/80 backdrop-blur-md": {},
          "backdrop-filter": "blur(12px)",
          "-webkit-backdrop-filter": "blur(12px)",
        },
        ".glass-sm": {
          "@apply bg-surface/90 backdrop-blur": {},
          "backdrop-filter": "blur(8px)",
          "-webkit-backdrop-filter": "blur(8px)",
        },
        ".gradient-primary": {
          "background-image": "linear-gradient(135deg, #006c49 0%, #10b981 100%)",
        },
        ".gradient-secondary": {
          "background-image": "linear-gradient(135deg, #0058be 0%, #3b82f6 100%)",
        },
        ".tonal-primary": {
          "@apply bg-primary-fixed text-on-primary-fixed": {},
        },
        ".tonal-secondary": {
          "@apply bg-secondary-fixed text-on-secondary-fixed": {},
        },
        ".tonal-tertiary": {
          "@apply bg-tertiary-fixed text-on-tertiary-fixed": {},
        },
        ".no-border-rule": {
          "border": "none",
          "outline": "none",
        },
        ".ghost-border": {
          "@apply border border-outline-variant/10": {},
        },
        ".ghost-border-focus": {
          "@apply border border-outline-variant/30 shadow-focus": {},
        },
      });
    },
  ],
};
export default config;

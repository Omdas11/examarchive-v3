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
        // Stitch design spec: Inter throughout the UI
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Legacy support
        background: "var(--background)",
        foreground: "var(--foreground)",

        // Material Design 3 - Primary (Deep Indigo)
        primary: "#3525cd",
        "primary-container": "#4f46e5",
        "on-primary": "#ffffff",
        "on-primary-container": "#dad7ff",
        "primary-fixed": "#e2dfff",
        "primary-fixed-dim": "#c3c0ff",
        "on-primary-fixed": "#0f0069",
        "on-primary-fixed-variant": "#3323cc",

        // Material Design 3 - Secondary (Muted Teal)
        secondary: "#006a61",
        "secondary-container": "#86f2e4",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#006f66",
        "secondary-fixed": "#89f5e7",
        "secondary-fixed-dim": "#6bd8cb",
        "on-secondary-fixed": "#00201d",
        "on-secondary-fixed-variant": "#005049",

        // Material Design 3 - Tertiary (Warm Brown/Gold)
        tertiary: "#684000",
        "tertiary-container": "#885500",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ffd4a4",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "on-tertiary-fixed-variant": "#653e00",

        // Surface & Background
        surface: "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "surface-variant": "#d3e4fe",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#464555",

        // Error & Status
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Outline & Borders
        outline: "#777587",
        "outline-variant": "#c7c4d8",

        // Background & Inverse
        "on-background": "#0b1c30",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        "inverse-primary": "#c3c0ff",

        // Tint
        "surface-tint": "#4d44e3",
      },
      spacing: {
        xs: "0.5rem",     // 8px
        sm: "1rem",       // 16px
        md: "1.5rem",     // 24px
        lg: "2rem",       // 32px
        xl: "2.5rem",     // 40px
        "2xl": "3rem",    // 48px
        "3xl": "4rem",    // 64px
        "4xl": "6rem",    // 96px (spacing-24 in MD3)
      },
      borderRadius: {
        xs: "0.25rem",    // 4px
        sm: "0.5rem",     // 8px
        md: "0.75rem",    // 12px
        lg: "1rem",       // 16px
        xl: "1.5rem",     // 24px
        full: "9999px",
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5" }],      // 12px
        sm: ["0.875rem", { lineHeight: "1.5" }],     // 14px
        base: ["1rem", { lineHeight: "1.6" }],       // 16px - body-md
        lg: ["1.125rem", { lineHeight: "1.6" }],     // 18px - body-lg
        xl: ["1.25rem", { lineHeight: "1.6" }],      // 20px - headline-sm
        "2xl": ["1.5rem", { lineHeight: "1.4" }],    // 24px - headline-md
        "3xl": ["2rem", { lineHeight: "1.4" }],      // 32px - display-sm
        "4xl": ["2.25rem", { lineHeight: "1.2" }],   // 36px - display-md
        "5xl": ["3rem", { lineHeight: "1.2" }],      // 48px - display-lg
      },
      boxShadow: {
        // Ambient shadow for floating elements (Stitch spec)
        ambient: "0 10px 30px rgba(11, 28, 48, 0.06)",
        // Tonal lift (used for cards on tonal backgrounds)
        lift: "0 2px 8px rgba(11, 28, 48, 0.04)",
        // Subtle focus state
        focus: "0 0 0 3px rgba(53, 37, 205, 0.1)",
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
          "background-image": "linear-gradient(135deg, #3525cd 0%, #4f46e5 100%)",
        },
        ".gradient-secondary": {
          "background-image": "linear-gradient(135deg, #006a61 0%, #86f2e4 100%)",
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
          "@apply border border-outline-variant/20": {},
        },
        ".ghost-border-focus": {
          "@apply border border-outline-variant/50 shadow-focus": {},
        },
      });
    },
  ],
};
export default config;

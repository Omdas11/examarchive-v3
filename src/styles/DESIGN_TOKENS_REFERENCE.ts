export const designTokens = {
  colors: {
    primary: "#3525cd",
    primaryContainer: "#4f46e5",
    onPrimary: "#ffffff",
    secondary: "#006a61",
    secondaryContainer: "#86f2e4",
    onSecondary: "#ffffff",
    tertiary: "#684000",
    tertiaryContainer: "#885500",
    onTertiary: "#ffffff",
    surface: "#f8f9ff",
    surfaceContainerLowest: "#ffffff",
    surfaceContainerLow: "#eff4ff",
    surfaceContainer: "#e5eeff",
    surfaceContainerHigh: "#dce9ff",
    surfaceContainerHighest: "#d3e4fe",
    onSurface: "#0b1c30",
    onSurfaceVariant: "#464555",
    error: "#ba1a1a",
    outlineVariant: "#c7c4d8",
  },
  spacing: {
    xs: "0.5rem",
    sm: "1rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "2.5rem",
    x2l: "3rem",
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
  },
} as const;

export const layoutClassNames = {
  page: "bg-surface text-on-surface",
  section: "bg-surface-container-low rounded-lg",
  panel: "bg-surface-container border border-outline-variant/20 rounded-lg",
  glass: "glass border border-outline-variant/10",
  primaryButton: "gradient-primary text-on-primary rounded-lg font-semibold",
  secondaryButton: "bg-surface-container-high text-on-surface rounded-lg font-semibold",
  subtleText: "text-on-surface-variant",
} as const;

export type DesignTokens = typeof designTokens;

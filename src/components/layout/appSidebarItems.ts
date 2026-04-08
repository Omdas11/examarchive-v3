export interface AppSidebarItem {
  label: string;
  icon: string; // Material Symbols name
  href: string;
  badge?: number;
  /** Roles that may see this item. Omit to show to all roles. */
  roles?: string[];
}

const ALL_AUTHENTICATED_ROLES = [
  "viewer",
  "guest",
  "curator",
  "visitor",
  "student",
  "explorer",
  "contributor",
  "verified_contributor",
  "moderator",
  "admin",
  "founder",
];

export const APP_SIDEBAR_ITEMS: AppSidebarItem[] = [
  // ── Main ──────────────────────────────────────────────
  {
    label: "Home",
    icon: "home",
    href: "/",
  },
  {
    label: "Dashboard",
    icon: "dashboard",
    href: "/dashboard",
  },
  {
    label: "Browse",
    icon: "library_books",
    href: "/browse",
  },
  {
    label: "Syllabus",
    icon: "menu_book",
    href: "/syllabus",
  },
  {
    label: "AI Content",
    icon: "auto_awesome",
    href: "/ai-content",
  },
  {
    label: "Upload Question Paper",
    icon: "upload_file",
    href: "/upload",
  },
  // ── Info ──────────────────────────────────────────────
  {
    label: "About",
    icon: "info",
    href: "/about",
  },
  {
    label: "Support",
    icon: "help",
    href: "/support",
  },
  // ── Account ───────────────────────────────────────────
  {
    label: "My Profile",
    icon: "person",
    href: "/profile",
  },
  {
    label: "Settings",
    icon: "settings",
    href: "/settings",
  },
  // ── Admin (moderator / admin / founder only) ──────────
  {
    label: "Admin Panel",
    icon: "admin_panel_settings",
    href: "/admin",
    roles: ["admin", "moderator", "founder", "maintainer"],
  },
  {
    label: "AI Controls",
    icon: "monitoring",
    href: "/admin/ai-stats",
    roles: ["admin", "founder", "maintainer"],
  },
  {
    label: "MD Ingestion",
    icon: "upload_file",
    href: "/admin/ingest-md",
    roles: ["admin", "founder", "maintainer"],
  },
  {
    label: "Syllabus Tracker",
    icon: "table_chart",
    href: "/admin/syllabus-tracker",
    roles: ALL_AUTHENTICATED_ROLES,
  },
  {
    label: "Manage Users",
    icon: "group",
    href: "/admin/users",
    roles: ["admin", "moderator", "founder", "maintainer"],
  },
  // ── Founder only ──────────────────────────────────────
  {
    label: "DevTool",
    icon: "construction",
    href: "/devtool",
    roles: ["founder"],
  },
];

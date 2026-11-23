export interface AppSidebarItem {
  label: string;
  icon: string; // Material Symbols name
  href: string;
  badge?: number;
  /** Short text tag shown as a pill next to the label (e.g. "Experimental"). */
  tag?: string;
  /** Roles that may see this item. Omit to show to all roles. */
  roles?: string[];
  /**
   * Also show to assigned md verifiers (students listed in
   * `md_verifiers`), even when their role is not in `roles`.
   */
  showForMdVerifier?: boolean;
}

/**
 * Sidebar visibility rule, shared with the Sidebar component so it can be
 * unit-tested: a role match wins, and an assigned md verifier also sees
 * items flagged `showForMdVerifier` (the friend is a student, so a
 * moderator/founder-only `roles` list alone would hide it from him).
 */
export function isSidebarItemVisible(
  item: Pick<AppSidebarItem, "roles" | "showForMdVerifier">,
  userRole: string,
  isMdVerifier: boolean,
): boolean {
  if (!item.roles || item.roles.includes(userRole)) return true;
  return Boolean(item.showForMdVerifier) && isMdVerifier;
}

const ALL_AUTHENTICATED_ROLES = [
  "student",
  "contributor",
  "specialist",
  "subject_admin",
  "moderator",
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
    label: "Exam Timetable",
    icon: "calendar_month",
    href: "/exam-timetable",
  },
  {
    label: "Notices",
    icon: "campaign",
    href: "/notices",
  },
  {
    label: "Submit a Paper",
    icon: "upload",
    href: "/submit-paper",
  },
  {
    label: "Syllabus Library",
    icon: "menu_book",
    href: "/syllabus",
  },
  {
    label: "Notes",
    icon: "notes",
    href: "/notes",
  },
  {
    label: "Syllabus Vault",
    icon: "import_contacts",
    href: "https://syllabus.examarchive.dev",
  },
  {
    label: "AI Notes",
    icon: "auto_awesome",
    href: "/ai-content",
    tag: "Experimental",
  },
  {
    label: "Study Resources",
    icon: "school",
    href: "/study-resources",
  },
  {
    label: "Store",
    icon: "shopping_cart",
    href: "/store",
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
  {
    label: "Maintenance Costs",
    icon: "volunteer_activism",
    href: "/maintenance-cost",
  },
  {
    label: "Colleges",
    icon: "domain",
    href: "/colleges",
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
  // ── Admin (moderator/founder only) ──────────
  {
    label: "Admin Panel",
    icon: "admin_panel_settings",
    href: "/admin",
    roles: ["moderator", "founder"],
  },
  {
    label: "Stats",
    icon: "monitoring",
    href: "/stats",
    roles: ALL_AUTHENTICATED_ROLES,
  },
  {
    label: "Manage Users",
    icon: "group",
    href: "/admin/users",
    roles: ["moderator", "founder"],
  },
  {
    label: "MD Verification",
    icon: "fact_check",
    href: "/admin/md-verification",
    roles: ["moderator", "founder", "verification_admin"],
    showForMdVerifier: true,
  },
  // ── Founder only ──────────────────────────────────────
  {
    label: "DevTool",
    icon: "construction",
    href: "/devtool",
    roles: ["founder"],
  },
];

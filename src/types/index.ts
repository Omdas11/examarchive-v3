/** Represents a single exam paper stored in the database. */
export interface Paper {
  id: string;
  title: string;
  /**
   * Paper code (e.g. "PHYDSC101T").
   * Persisted in the `papers` collection as `course_code`. Some documents also
   * carry the legacy alias `paper_code`. `toPaper` normalises both into this
   * field.
   */
  course_code?: string;
  course_name: string;
  year: number;
  semester: string;
  exam_type: string;
  department: string;
  file_url: string;
  uploaded_by: string;
  approved: boolean;
  created_at: string;
  /** Academic stream or branch (e.g. Science, Arts, Commerce). */
  stream?: string;
  /** University or institution name. */
  institution?: string;
  /** Academic programme (e.g. CBCS, FYUG). */
  programme?: string;
  /** Total marks for the paper. */
  marks?: number;
  /** Exam duration in minutes. */
  duration?: number;
  /** Number of times the paper has been viewed. */
  view_count?: number;
  /** Number of times the paper has been downloaded. */
  download_count?: number;
  /** Username of the uploader (denormalised for display). */
  uploaded_by_username?: string;
  /**
   * Paper type / category within the programme.
   * FYUGP: "DSC" | "DSM" | "SEC" | "IDC" | "GE"
   * CBCS:  "CC"  | "DSC" | "DSE" | "GEC" | "SEC"
   */
  paper_type?: string;
}

/** Represents a syllabus entry. */
export interface Syllabus {
  id: string;
  /** University or institution name. */
  university: string;
  /** Subject/course name. */
  subject: string;
  /** Department or stream. */
  department: string;
  /** Semester (e.g. "1st", "2nd"). */
  semester: string;
  /** Academic programme (e.g. CBCS, FYUG). */
  programme: string;
  /** Academic year (e.g. 2024). */
  year: number | null;
  /** Appwrite user ID of the uploader. */
  uploader_id: string;
  /** Whether the syllabus has been hidden by an admin. */
  is_hidden?: boolean;
  approval_status: "pending" | "approved" | "rejected";
  /** Public URL of the syllabus PDF. */
  file_url: string;
  created_at: string;
  // Legacy fields for backwards compatibility
  course_code?: string;
  course_name?: string;
  /** Username of the uploader (denormalised for display). */
  uploaded_by_username?: string;
}

/** Application-level user profile stored alongside Appwrite Auth. */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string;
  /** File ID of the avatar in Appwrite Storage (avatars bucket). */
  avatar_file_id?: string;
  role: UserRole;
  /** Community/custom secondary role, if any. */
  secondary_role?: CustomRole;
  /** Activity-based tier. */
  tier?: UserTier;
  xp: number;
  streak_days: number;
  last_activity: string;
  created_at: string;
}

/**
 * Supported user roles – ordered from least to most privileged.
 * "student" is kept as a legacy alias for "visitor" (level 0).
 *
 * Hierarchy: visitor → explorer → contributor → verified_contributor
 *            → moderator → maintainer → admin → founder
 */
export type UserRole =
  | "visitor"
  | "student"           // legacy alias for visitor (level 0)
  | "explorer"
  | "contributor"
  | "verified_contributor"
  | "moderator"
  | "maintainer"
  | "admin"
  | "founder";

/** Community/cosmetic custom roles (display-only, never grant permissions). */
export type CustomRole =
  | "reviewer"
  | "curator"
  | "mentor"
  | "archivist"
  | "ambassador"
  | "pioneer"
  | "researcher"
  | null;

/** User tier based on activity and achievements. */
export type UserTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/** A single achievement earned by a user. */
export interface Achievement {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  description: string;
  earned_at: string;
}

/** Extended user profile with v2-style role system and achievements. */
export interface ExtendedUserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string;
  /** Single authoritative role for this user. */
  role: UserRole;
  /** Community/custom cosmetic role, optional. */
  secondary_role: CustomRole;
  /** An additional optional community designation. */
  tertiary_role: CustomRole;
  /** Activity-based tier. */
  tier: UserTier;
  xp: number;
  streak_days: number;
  last_activity: string;
  achievements: Achievement[];
  created_at: string;
}

/** A single activity log entry for moderation/admin actions. */
export interface ActivityLogEntry {
  id: string;
  action: "approve" | "reject" | "role_change" | "tier_change";
  target_user_id: string | null;
  target_paper_id: string | null;
  admin_id: string;
  admin_email: string;
  details: string;
  created_at: string;
}

/** Admin-facing user record with all fields from the users collection. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string;
  /** Single authoritative role – the only field used for access control. */
  role: UserRole;
  /** @deprecated Use `role` instead. Kept for backward compatibility only. */
  primary_role: UserRole;
  secondary_role: CustomRole;
  tertiary_role: CustomRole;
  tier: UserTier;
  upload_count: number;
  xp: number;
  streak_days: number;
  /** Last login / activity timestamp (ISO 8601). */
  last_login: string;
  created_at: string;
}

/** Map an Appwrite document to our `AdminUser` type. */
export function toAdminUser(doc: Record<string, unknown>): AdminUser {
  return {
    id: (doc.$id ?? doc.id) as string,
    email: (doc.email ?? "") as string,
    name: (doc.display_name ?? doc.name ?? "") as string,
    username: (doc.username ?? "") as string,
    avatar_url: (doc.avatar_url ?? "") as string,
    role: ((doc.role as string) ?? "student") as UserRole,
    primary_role: ((doc.primary_role ?? doc.role ?? "student") as string) as UserRole,
    secondary_role: (doc.secondary_role ?? null) as CustomRole,
    tertiary_role: (doc.tertiary_role ?? null) as CustomRole,
    tier: ((doc.tier ?? "bronze") as string) as UserTier,
    upload_count: (doc.upload_count ?? 0) as number,
    xp: (doc.xp ?? 0) as number,
    streak_days: ((doc.streak_days ?? doc.streak ?? 0) as number),
    last_login: ((doc.last_login ?? doc.last_activity ?? "") as string),
    created_at: ((doc.$createdAt ?? doc.created_at) as string) ?? "",
  };
}

/** Map an Appwrite document to our `ActivityLogEntry` type. */
export function toActivityLog(doc: Record<string, unknown>): ActivityLogEntry {
  return {
    id: (doc.$id ?? doc.id) as string,
    action: (doc.action as ActivityLogEntry["action"]) ?? "approve",
    target_user_id: (doc.target_user_id as string) ?? null,
    target_paper_id: (doc.target_paper_id as string) ?? null,
    admin_id: (doc.admin_id as string) ?? "",
    admin_email: (doc.admin_email as string) ?? "",
    details: (doc.details as string) ?? "",
    created_at: ((doc.$createdAt ?? doc.created_at) as string) ?? "",
  };
}

/** Shape returned by the browse / search RPC. */
export interface BrowseFilters {
  department?: string;
  course_code?: string;
  year?: number;
  semester?: string;
  exam_type?: string;
  search?: string;
}

// ── Appwrite document mapping helpers ────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map an Appwrite document to our `Paper` type. */
export function toPaper(doc: any): Paper {
  const firstNonEmpty = (...values: unknown[]): string | undefined =>
    values.find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );

  const normalizedTitle =
    firstNonEmpty(doc.title, doc.paper_name, doc.course_name) ?? "";
  const normalizedCourseName =
    firstNonEmpty(doc.course_name, doc.paper_name, normalizedTitle) ?? normalizedTitle;

  return {
    id: doc.$id ?? doc.id,
    title: normalizedTitle,
    course_code: doc.course_code ?? doc.paper_code ?? undefined,
    course_name: normalizedCourseName,
    year: doc.year,
    semester: doc.semester ?? "",
    exam_type: doc.exam_type ?? "",
    department: doc.department ?? doc.subject ?? "",
    file_url: doc.file_url,
    uploaded_by: doc.uploaded_by ?? doc.uploader_id ?? "",
    approved: doc.approved,
    created_at: doc.$createdAt ?? doc.created_at,
    stream: doc.stream ?? undefined,
    // `institute` is the canonical field name in the backend schema.
    // Fall back to the legacy `institution` field for documents created before the rename.
    institution: doc.institute ?? doc.institution ?? doc.university ?? undefined,
    programme: doc.programme ?? undefined,
    marks: doc.marks ?? undefined,
    duration: doc.duration ?? undefined,
    view_count: doc.view_count ?? 0,
    download_count: doc.download_count ?? 0,
    uploaded_by_username: doc.uploaded_by_username ?? undefined,
    paper_type: doc.paper_type ?? undefined,
  };
}

/** Map an Appwrite document to our `Syllabus` type. */
export function toSyllabus(doc: any): Syllabus {
  return {
    id: doc.$id ?? doc.id,
    university: doc.university ?? doc.institution ?? "",
    subject: doc.subject ?? doc.course_name ?? "",
    department: doc.department ?? "",
    semester: doc.semester ?? "",
    programme: doc.programme ?? "",
    year: doc.year ?? null,
    uploader_id: doc.uploader_id ?? doc.uploaded_by ?? "",
    approval_status: (doc.approval_status ?? "pending") as Syllabus["approval_status"],
    file_url: doc.file_url ?? "",
    created_at: doc.$createdAt ?? doc.created_at ?? "",
    course_code: doc.course_code,
    course_name: doc.course_name ?? doc.subject,
    uploaded_by_username: doc.uploaded_by_username ?? undefined,
    is_hidden: doc.is_hidden ?? false,
  };
}

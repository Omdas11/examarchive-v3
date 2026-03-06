/** Represents a single exam paper stored in the database. */
export interface Paper {
  id: string;
  title: string;
  course_code: string;
  course_name: string;
  year: number;
  semester: string;
  exam_type: string;
  department: string;
  file_url: string;
  uploaded_by: string;
  approved: boolean;
  created_at: string;
}

/** Represents a syllabus entry. */
export interface Syllabus {
  id: string;
  course_code: string;
  course_name: string;
  department: string;
  file_url: string;
  created_at: string;
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
  xp: number;
  streak_days: number;
  last_activity: string;
  created_at: string;
}

/** Supported user roles. */
export type UserRole = "student" | "moderator" | "admin";

/** Extended roles migrated from ExamArchive-v2 (custom/community roles). */
export type CustomRole =
  | "contributor"
  | "reviewer"
  | "curator"
  | "mentor"
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
  /** Primary role: the main access-control role. */
  primary_role: UserRole;
  /** Secondary role: a community/custom role, optional. */
  secondary_role: CustomRole;
  /** Tertiary role: an additional optional designation. */
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
  role: UserRole;
  primary_role: UserRole;
  secondary_role: CustomRole;
  tertiary_role: CustomRole;
  tier: UserTier;
  upload_count: number;
  xp: number;
  streak_days: number;
  created_at: string;
}

/** Map an Appwrite document to our `AdminUser` type. */
export function toAdminUser(doc: Record<string, unknown>): AdminUser {
  return {
    id: (doc.$id ?? doc.id) as string,
    email: (doc.email ?? "") as string,
    name: (doc.name ?? "") as string,
    username: (doc.username ?? "") as string,
    avatar_url: (doc.avatar_url ?? "") as string,
    role: ((doc.role as string) ?? "student") as UserRole,
    primary_role: ((doc.primary_role ?? doc.role ?? "student") as string) as UserRole,
    secondary_role: (doc.secondary_role ?? null) as CustomRole,
    tertiary_role: (doc.tertiary_role ?? null) as CustomRole,
    tier: ((doc.tier ?? "bronze") as string) as UserTier,
    upload_count: (doc.upload_count ?? 0) as number,
    xp: (doc.xp ?? 0) as number,
    streak_days: (doc.streak_days ?? 0) as number,
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
  return {
    id: doc.$id ?? doc.id,
    title: doc.title,
    course_code: doc.course_code,
    course_name: doc.course_name,
    year: doc.year,
    semester: doc.semester,
    exam_type: doc.exam_type,
    department: doc.department,
    file_url: doc.file_url,
    uploaded_by: doc.uploaded_by,
    approved: doc.approved,
    created_at: doc.$createdAt ?? doc.created_at,
  };
}

/** Map an Appwrite document to our `Syllabus` type. */
export function toSyllabus(doc: any): Syllabus {
  return {
    id: doc.$id ?? doc.id,
    course_code: doc.course_code,
    course_name: doc.course_name,
    department: doc.department,
    file_url: doc.file_url,
    created_at: doc.$createdAt ?? doc.created_at,
  };
}

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

/** Application-level user profile stored alongside Supabase Auth. */
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
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
  /** Primary role: the main access-control role. */
  primary_role: UserRole;
  /** Secondary role: a community/custom role, optional. */
  secondary_role: CustomRole;
  /** Tertiary role: an additional optional designation. */
  tertiary_role: CustomRole;
  /** Activity-based tier. */
  tier: UserTier;
  achievements: Achievement[];
  created_at: string;
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

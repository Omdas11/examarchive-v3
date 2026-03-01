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

/** Shape returned by the browse / search RPC. */
export interface BrowseFilters {
  department?: string;
  course_code?: string;
  year?: number;
  semester?: string;
  exam_type?: string;
  search?: string;
}

import { redirect } from "next/navigation";

/**
 * Moved 2026-11-22: the exam timetable is public now at /exam-timetable
 * (same tracker, for all users, no login). This route stays only so old
 * admin bookmarks and sidebar links land on the new page instead of a 404.
 */
export default function AdminExamTimetableRedirect() {
  redirect("/exam-timetable");
}

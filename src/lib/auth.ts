/**
 * Helpers for FDU-specific auth validation.
 * Mirrors the rules from the original Streamlit NuAnswers app.
 */

const FDU_EMAIL_RE = /^[a-z0-9._%+-]+@(student\.)?fdu\.edu$/i;
const STUDENT_ID_RE = /^\d{7}$/;

export function isFduEmail(email: string): boolean {
  return FDU_EMAIL_RE.test(email.trim());
}

export function isValidStudentId(id: string): boolean {
  return STUDENT_ID_RE.test(id.trim());
}

export const FDU_EMAIL_HINT =
  "Use your @student.fdu.edu or @fdu.edu address.";

export const STUDENT_ID_HINT = "Your 7-digit FDU Student ID.";

export const GRADES = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
] as const;

export const CAMPUSES = ["Florham", "Metro", "Vancouver"] as const;

export const MAJORS = [
  "Accounting",
  "Finance",
  "MIS [Management Information Systems]",
] as const;

export type Grade = (typeof GRADES)[number];
export type Campus = (typeof CAMPUSES)[number];
export type Major = (typeof MAJORS)[number];

export type Profile = {
  id: string;
  full_name: string;
  student_id: string;
  grade: Grade | null;
  campus: Campus | null;
  major: Major | null;
  current_course_id: string | null;
  current_course_name: string | null;
  current_professor_name: string | null;
  current_professor_email: string | null;
  created_at: string;
  updated_at: string;
};

export function isProfileComplete(profile: Pick<Profile, "grade" | "campus" | "major">): boolean {
  return Boolean(profile.grade && profile.campus && profile.major);
}

const COURSE_ID_RE = /^(ACCT|ECON|FIN|MIS|WMA)_\d{4}_\d{2}$/;

export function isValidCourseId(id: string): boolean {
  return COURSE_ID_RE.test(id.trim());
}

export const COURSE_ID_HINT =
  "Format: DEPT_####_##  (e.g., ACCT_3220_01, FIN_3250_02). Allowed prefixes: ACCT, ECON, FIN, MIS, WMA.";

export type ClassContext = {
  course_id: string;
  course_name: string;
  professor_name: string;
  professor_email: string;
};

/**
 * Extract a professor's last name from a free-form name string. Handles
 * "Dr. Jane Smith" → "Smith", "Jane Smith" → "Smith", "Smith" → "Smith",
 * empty/null → "" so callers can decide a default.
 */
export function professorLastName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1];
}

export function profileClassContext(
  profile: Pick<
    Profile,
    | "current_course_id"
    | "current_course_name"
    | "current_professor_name"
    | "current_professor_email"
  >
): ClassContext | null {
  if (
    !profile.current_course_id ||
    !profile.current_course_name ||
    !profile.current_professor_name ||
    !profile.current_professor_email
  ) {
    return null;
  }
  return {
    course_id: profile.current_course_id,
    course_name: profile.current_course_name,
    professor_name: profile.current_professor_name,
    professor_email: profile.current_professor_email,
  };
}

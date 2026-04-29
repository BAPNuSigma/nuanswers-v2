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
  grade: Grade;
  campus: Campus;
  major: Major;
  created_at: string;
  updated_at: string;
};

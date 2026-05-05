import { cookies } from "next/headers";

/**
 * Lightweight password gate for the chapter staff dashboards (/admin and
 * /professors). One shared password, set via STAFF_PASSWORD env var. After
 * a correct submission an HttpOnly cookie is set so the browser doesn't
 * have to ask again.
 *
 * This is intentionally simple — no per-user accounts, no MFA, no rate
 * limiting. Carlo asked for "one sign on for officers and professors,
 * we can improve for security later". Documented constraints:
 *   - Anyone with the password can see all chapter data.
 *   - Privacy is not a concern (memory: project_privacy_not_a_concern).
 *   - This does not gate the student-facing /chat — that still uses
 *     FDU email OTP via Supabase Auth.
 */

export const STAFF_COOKIE_NAME = "nuanswers-staff-auth";

// 30 days. Officers + professors stay signed in for the academic month
// without re-entering the password. Bump if it gets annoying.
export const STAFF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function isStaffSignedIn(): Promise<boolean> {
  const c = await cookies();
  const value = c.get(STAFF_COOKIE_NAME)?.value;
  if (!value) return false;
  const expected = staffCookieValue();
  if (!expected) return false;
  return constantTimeEqual(value, expected);
}

/**
 * The cookie value mirrors the env-set password. Since the cookie is
 * HttpOnly + Secure, the browser can't read or forge it from JS, and
 * the server checks it with a constant-time compare against the live
 * env value on every request — so rotating STAFF_PASSWORD invalidates
 * every existing session immediately.
 */
export function staffCookieValue(): string | null {
  return process.env.STAFF_PASSWORD?.trim() || null;
}

export function checkStaffPassword(submitted: string): boolean {
  const expected = process.env.STAFF_PASSWORD?.trim();
  if (!expected) return false;
  return constantTimeEqual(submitted.trim(), expected);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

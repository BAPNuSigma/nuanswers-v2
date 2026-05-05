import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for chapter-staff dashboards. Bypasses Row
 * Level Security so /admin and /professors can aggregate across every
 * student without each visitor needing per-table read grants.
 *
 * IMPORTANT: only use this on routes that are already gated by
 * isStaffSignedIn() in src/lib/staff-auth.ts. Never expose the client or
 * its results to a route a student could reach directly.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var, set in Vercel from
 * Supabase Dashboard → Settings → API → service_role secret.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

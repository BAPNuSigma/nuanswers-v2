import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Resolve user_ids → email addresses via the Supabase Auth admin API.
 * Emails live in `auth.users` which isn't queryable through the data API,
 * so we have to use admin.listUsers() and build a lookup. For chapters
 * up to ~1000 students this fits in a single page; we paginate if larger.
 *
 * Service-role only. Safe to call from any staff-gated server component.
 */
export async function fetchEmailsByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const wanted = new Set(userIds);

  let page = 1;
  const perPage = 1000; // Supabase max
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) break;
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && wanted.has(u.id)) {
        out.set(u.id, u.email);
      }
    }
    if (users.length < perPage) break;
    if (out.size >= wanted.size) break;
    page += 1;
    if (page > 5) break; // hard safety: never page beyond 5,000 users
  }
  return out;
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if any student has listed `email` as their professor (either
 * on their profile.current_professor_email, or on any document/session they
 * created). Used to route prof-emails to /professors instead of /onboarding
 * after they sign in.
 */
export async function isKnownProfessor(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const e = email.trim().toLowerCase();
  if (!e) return false;

  const { count } = await supabase
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .eq("professor_email", e);

  if ((count ?? 0) > 0) return true;

  const { count: profileCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("current_professor_email", e);

  return (profileCount ?? 0) > 0;
}

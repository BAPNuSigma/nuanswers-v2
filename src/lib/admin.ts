/**
 * Who can see the chapter-wide admin dashboard at /admin.
 *
 * Source order:
 *   1. ADMIN_EMAILS env var (comma-separated list, all lowercased)
 *   2. Built-in fallback list — Carlo + the BAP chapter address
 *
 * Both sources are merged so deploys without the env var still work for
 * the default admins. Set ADMIN_EMAILS in Vercel to override or extend.
 */
const FALLBACK_ADMIN_EMAILS = [
  "carloalessandrot10@gmail.com",
  "bapfdu@gmail.com",
];

function adminEmailSet(): Set<string> {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...FALLBACK_ADMIN_EMAILS, ...fromEnv]);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.trim().toLowerCase());
}

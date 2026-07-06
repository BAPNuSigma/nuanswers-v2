import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Pinged daily by Vercel Cron (see vercel.json). Free-tier Supabase
 * projects auto-pause after ~7 days with no API activity — which is
 * exactly what happens over summer and winter break. One tiny query a
 * day keeps the database awake year-round.
 *
 * If a CRON_SECRET env var is set in Vercel, only requests carrying it
 * are accepted (Vercel Cron sends it automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, profiles: count ?? 0 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

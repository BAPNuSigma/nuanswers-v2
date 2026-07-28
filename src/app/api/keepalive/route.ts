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

    // Diagnostic mirror of the admin page's daily-activity chart, so the
    // chart pipeline can be verified without a staff login. Exposes only
    // per-day message counts — no content, no identities.
    const sinceISO = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: windowMessages, error: chartError } = await supabase
      .from("messages")
      .select("created_at")
      .eq("role", "user")
      .gte("created_at", sinceISO)
      .limit(1000);
    const daily: Record<string, number> = {};
    for (const m of windowMessages ?? []) {
      const day = String(m.created_at ?? "").slice(0, 10);
      daily[day] = (daily[day] ?? 0) + 1;
    }
    return NextResponse.json({
      ok: true,
      profiles: count ?? 0,
      chart: {
        windowRows: windowMessages?.length ?? 0,
        daily,
        sampleTimestamps: (windowMessages ?? [])
          .slice(0, 3)
          .map((m) => m.created_at),
        chartError: chartError ? String(chartError) : null,
        sinceISO,
      },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type IncomingEvent = {
  event_type: string;
  user_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
};

export async function POST(req: Request) {
  let body: IncomingEvent;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (!body?.event_type || typeof body.event_type !== "string") {
    return NextResponse.json(
      { ok: false, error: "missing_event_type" },
      { status: 400 }
    );
  }

  // Use the authenticated user's id from the session, not whatever the client sends.
  // (Client-supplied user_id can't be trusted for analytics.)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("analytics_events").insert({
    user_id: user?.id ?? null,
    session_id: null, // chat_sessions integration comes in Phase 2b
    event_type: body.event_type,
    metadata: {
      ...(body.metadata ?? {}),
      client_session_id: body.session_id ?? null,
    },
  });

  if (error) {
    console.warn("[analytics] insert failed:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

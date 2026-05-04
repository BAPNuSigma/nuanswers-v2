import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("id, started_at, ended_at, message_count, course_name, course_id, professor")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Pull the first user message of each session as a label preview.
  const ids = (sessions ?? []).map((s) => s.id);
  const previews: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("session_id, content, created_at, role")
      .eq("user_id", user.id)
      .in("session_id", ids)
      .eq("role", "user")
      .order("created_at", { ascending: true });

    for (const m of msgs ?? []) {
      if (!previews[m.session_id]) {
        previews[m.session_id] = m.content;
      }
    }
  }

  const enriched = (sessions ?? []).map((s) => ({
    ...s,
    preview: previews[s.id] ?? null,
  }));

  return NextResponse.json({ sessions: enriched });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create session." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}

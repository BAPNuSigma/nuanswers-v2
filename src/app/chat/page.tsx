import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient, type StoredMessage } from "./ChatClient";
import {
  isProfileComplete,
  profileClassContext,
  type Profile,
} from "@/lib/auth";
import { getTutoringHoursStatus } from "@/lib/tutoring-hours";
import { TutoringHoursBlocker } from "./TutoringHoursBlocker";
import type { DocumentRow } from "./MaterialsBar";

type ChatPageProps = {
  searchParams: Promise<{ session?: string; new?: string }>;
};

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    redirect("/onboarding");
  }

  // In-person tutoring hours: bot pauses so students go to the chapter's
  // in-person session instead. Skipped automatically outside the window
  // and when TUTORING_HOURS_DISABLED=true.
  const tutoringHours = getTutoringHoursStatus();
  if (tutoringHours.active) {
    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_type: "tutoring_hours_blocked",
      metadata: { day: tutoringHours.day, time_et: tutoringHours.timeET },
    });
    return (
      <TutoringHoursBlocker
        status={tutoringHours}
        email={user.email ?? ""}
      />
    );
  }

  const { data: documents } = await supabase
    .from("documents")
    .select(
      "id, filename, file_type, file_size_bytes, chunk_count, status, error_message, created_at, professor_name"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const explicitSessionId = params.session ?? null;
  const wantsNew = params.new === "1";

  // Determine which session to load:
  //   ?new=1                → start a fresh chat (no session row yet; created on first send)
  //   ?session=<uuid>       → load that specific session
  //   (default)             → resume the most recent session, or fresh if none
  let activeSessionId: string | null = null;
  let initialMessages: StoredMessage[] = [];

  if (!wantsNew) {
    const targetId = explicitSessionId;
    if (targetId) {
      const { data: session } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("id", targetId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (session) activeSessionId = session.id;
    } else {
      const { data: latest } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) activeSessionId = latest.id;
    }

    if (activeSessionId) {
      const { data: messages } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("session_id", activeSessionId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      initialMessages = (messages ?? []) as StoredMessage[];
    }
  }

  return (
    <ChatClient
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile.full_name}
      profileComplete={isProfileComplete(profile)}
      initialDocuments={(documents ?? []) as DocumentRow[]}
      initialSessionId={activeSessionId}
      initialMessages={initialMessages}
      initialClass={profileClassContext(profile)}
    />
  );
}

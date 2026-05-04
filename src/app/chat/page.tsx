import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient, type StoredMessage } from "./ChatClient";
import {
  isProfileComplete,
  profileClassContext,
  type Profile,
} from "@/lib/auth";
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

  if (!profile) redirect("/onboarding");

  const { data: documents } = await supabase
    .from("documents")
    .select(
      "id, filename, file_type, file_size_bytes, chunk_count, status, error_message, created_at"
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

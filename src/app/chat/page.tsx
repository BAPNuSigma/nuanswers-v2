import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "./ChatClient";
import { isProfileComplete, type Profile } from "@/lib/auth";
import type { DocumentRow } from "./MaterialsBar";

export default async function ChatPage() {
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

  return (
    <ChatClient
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile.full_name}
      profileComplete={isProfileComplete(profile)}
      initialDocuments={(documents ?? []) as DocumentRow[]}
    />
  );
}

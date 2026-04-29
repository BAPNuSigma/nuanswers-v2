import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "./ChatClient";
import { isProfileComplete, type Profile } from "@/lib/auth";

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

  return (
    <ChatClient
      userId={user.id}
      email={user.email ?? ""}
      fullName={profile.full_name}
      profileComplete={isProfileComplete(profile)}
    />
  );
}

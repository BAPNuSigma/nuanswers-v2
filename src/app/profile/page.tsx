import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { ProfileForm } from "./ProfileForm";
import type { Profile } from "@/lib/auth";

export default async function ProfilePage() {
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
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/chat">
            <Wordmark size="md" />
          </Link>
          <Link
            href="/chat"
            className="text-sm text-ink-300 hover:text-gold-300"
          >
            Back to chat →
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Your profile
        </h1>
        <p className="mt-3 text-sm text-ink-300">
          Help BAP Nu Sigma track chapter analytics. Optional — you can skip or
          come back any time.
        </p>
        <ProfileForm profile={profile} />
      </main>
    </div>
  );
}

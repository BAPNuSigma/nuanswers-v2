import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If profile already exists, skip onboarding.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) redirect("/chat");

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-5 sm:px-8">
          <Wordmark size="md" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-12">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          One-time setup
        </h1>
        <p className="mt-3 text-sm text-ink-300">
          Tell us a little about you. We use this for chapter analytics — never
          shared outside BAP Nu Sigma.
        </p>
        <OnboardingForm email={user.email ?? ""} userId={user.id} />
      </main>
    </div>
  );
}

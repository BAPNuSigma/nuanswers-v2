import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { isKnownProfessor } from "@/lib/professors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // If the URL pinned a `next=...`, honor it (e.g. came back from /admin).
  if (explicitNext) {
    return NextResponse.redirect(`${origin}${explicitNext}`);
  }

  const email = user.email ?? "";

  // Admins land on /admin by default. They can still navigate to /chat or
  // /professors from there if they want to test other surfaces.
  if (isAdminEmail(email)) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  // Professors (recognized by being listed on a student's class context)
  // go to /professors.
  if (email && (await isKnownProfessor(supabase, email))) {
    return NextResponse.redirect(`${origin}/professors`);
  }

  // Students: /onboarding if no profile yet, else /chat.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}/chat`);
}

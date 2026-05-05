import { redirect } from "next/navigation";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isStaffSignedIn } from "@/lib/staff-auth";
import { StaffSignInForm } from "./StaffSignInForm";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function StaffSignInPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const target = sanitizeNext(next);

  // Already authenticated → bounce back to where they came from.
  if (await isStaffSignedIn()) {
    redirect(target);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-gold-700/50 bg-gold-900/20 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-gold-300">
          Staff sign-in
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Officer + professor access
        </h1>
        <p className="mt-3 text-sm text-ink-300">
          One shared password gates the chapter dashboards (/admin and
          /professors). Get it from your BAP officer.
        </p>

        <StaffSignInForm next={target} initialError={error ?? null} />

        <p className="mt-8 text-xs text-ink-400">
          Looking for the student tutor?{" "}
          <Link
            href="/chat"
            className="text-gold-300 underline-offset-2 hover:underline"
          >
            Go to /chat
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function sanitizeNext(next: string | undefined): string {
  // Only allow relative redirects to known staff routes — never an absolute URL.
  if (!next) return "/admin";
  if (!next.startsWith("/")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  if (next === "/admin" || next.startsWith("/admin?")) return next;
  if (next === "/professors" || next.startsWith("/professors?")) return next;
  if (next.startsWith("/professors/")) return next;
  return "/admin";
}

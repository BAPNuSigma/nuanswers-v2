"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isFduEmail, FDU_EMAIL_HINT } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!isFduEmail(trimmed)) {
      setError(FDU_EMAIL_HINT);
      return;
    }

    setStatus("sending");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-5 sm:px-8">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-ink-300">
          Enter your FDU email — we&apos;ll send you a one-tap login link. No
          password to remember.
        </p>

        {status === "sent" ? (
          <CheckEmail email={email} onReset={() => setStatus("idle")} />
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-200">
                FDU email
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="firstname.lastname@student.fdu.edu"
                className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
              />
              <span className="text-xs text-ink-400">{FDU_EMAIL_HINT}</span>
            </label>

            {error && (
              <p className="rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-sm text-crimson-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-crimson-700 font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "sending" ? "Sending link…" : "Send login link"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-xs text-ink-400">
          By signing in you agree that NuAnswers logs your usage to improve
          tutoring for the BAP Nu Sigma chapter.
        </p>
      </main>
    </div>
  );
}

function CheckEmail({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  return (
    <div className="mt-8 rounded-2xl border border-gold-700/40 bg-gold-900/15 p-6 text-center">
      <div className="font-serif text-xl text-gold-300">Check your email</div>
      <p className="mt-3 text-sm leading-relaxed text-ink-200">
        We sent a sign-in link to <strong>{email}</strong>. Open it on this
        device to finish logging in. The link expires in 1 hour.
      </p>
      <button
        onClick={onReset}
        className="mt-5 text-xs text-ink-300 underline underline-offset-2 hover:text-gold-300"
      >
        Wrong email? Try again
      </button>
    </div>
  );
}

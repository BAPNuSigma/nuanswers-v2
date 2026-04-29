"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isFduEmail, FDU_EMAIL_HINT } from "@/lib/auth";
import { Wordmark } from "@/components/Wordmark";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!isFduEmail(trimmed)) {
      setError(FDU_EMAIL_HINT);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setEmail(trimmed);
    setStep("code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: cleaned,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    router.replace("/chat");
  }

  function handleStartOver() {
    setStep("email");
    setCode("");
    setError(null);
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
          {step === "email"
            ? "Enter your FDU email — we'll text you a 6-digit code. No password to remember."
            : `Enter the 6-digit code we sent to ${email}.`}
        </p>

        {step === "email" && (
          <form onSubmit={handleSendCode} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-200">
                FDU email
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                autoFocus
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
              disabled={submitting}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-crimson-700 font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Sending code…" : "Send code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-200">
                6-digit code
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-foreground placeholder:text-ink-500 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
              />
              <span className="text-xs text-ink-400">
                Check your inbox AND spam folder. Code expires in 1 hour.
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-sm text-crimson-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-crimson-700 font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Verifying…" : "Verify and sign in"}
            </button>

            <button
              type="button"
              onClick={handleStartOver}
              className="text-center text-xs text-ink-400 underline-offset-2 hover:text-gold-300 hover:underline"
            >
              ← Use a different email
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

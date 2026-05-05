"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function StaffSignInForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Sign-in failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-200">
          Staff password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
        />
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
        {submitting ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

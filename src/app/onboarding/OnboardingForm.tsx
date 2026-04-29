"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STUDENT_ID_HINT, isValidStudentId } from "@/lib/auth";

export function OnboardingForm({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!isValidStudentId(studentId)) {
      setError("Student ID must be exactly 7 digits.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: fullName.trim(),
      student_id: studentId.trim(),
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_type: "signup_completed",
    });

    router.replace("/chat");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-300">
        Logged in as <span className="font-medium text-foreground">{email}</span>
      </div>

      <Field label="Full name">
        <input
          required
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Doe"
          className={inputClass}
        />
      </Field>

      <Field label="FDU Student ID" hint={STUDENT_ID_HINT}>
        <input
          required
          value={studentId}
          onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
          maxLength={7}
          inputMode="numeric"
          pattern="\d{7}"
          placeholder="1234567"
          className={inputClass}
        />
      </Field>

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
        {submitting ? "Saving…" : "Continue to NuAnswers"}
      </button>

      <p className="text-center text-xs text-ink-400">
        Two fields, that&apos;s it. You can add grade, campus, and major later
        on your profile page — totally optional.
      </p>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-200">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

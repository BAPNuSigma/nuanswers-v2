"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPUSES,
  GRADES,
  MAJORS,
  STUDENT_ID_HINT,
  isValidStudentId,
  type Campus,
  type Grade,
  type Major,
} from "@/lib/auth";

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
  const [grade, setGrade] = useState<Grade>("Freshman");
  const [campus, setCampus] = useState<Campus>("Florham");
  const [major, setMajor] = useState<Major>("Accounting");
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
      grade,
      campus,
      major,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_type: "signup_completed",
      metadata: { grade, campus, major },
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Grade">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade)}
            className={inputClass}
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Campus">
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value as Campus)}
            className={inputClass}
          >
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Major">
        <select
          value={major}
          onChange={(e) => setMajor(e.target.value as Major)}
          className={inputClass}
        >
          {MAJORS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
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

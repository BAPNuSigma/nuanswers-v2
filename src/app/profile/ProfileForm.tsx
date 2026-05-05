"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CAMPUSES,
  GRADES,
  MAJORS,
  type Campus,
  type Grade,
  type Major,
  type Profile,
} from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [grade, setGrade] = useState<Grade | "">(profile.grade ?? "");
  const [campus, setCampus] = useState<Campus | "">(profile.campus ?? "");
  const [major, setMajor] = useState<Major | "">(profile.major ?? "");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Full name can't be blank.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        grade: grade || null,
        campus: campus || null,
        major: major || null,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setStatus("idle");
      return;
    }

    await supabase.from("analytics_events").insert({
      user_id: profile.id,
      event_type: "profile_updated",
      metadata: { has_grade: !!grade, has_campus: !!campus, has_major: !!major },
    });

    setStatus("saved");
    router.refresh();
    setTimeout(() => setStatus("idle"), 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
      <Field label="Full name">
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Student ID">
        <input
          value={profile.student_id}
          disabled
          className={`${inputClass} cursor-not-allowed opacity-60`}
        />
        <span className="text-xs text-ink-400">
          Contact BAP if your ID is wrong.
        </span>
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Grade (optional)">
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade | "")}
            className={inputClass}
          >
            <option value="">— Skip —</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Campus (optional)">
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value as Campus | "")}
            className={inputClass}
          >
            <option value="">— Skip —</option>
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Major (optional)">
        <select
          value={major}
          onChange={(e) => setMajor(e.target.value as Major | "")}
          className={inputClass}
        >
          <option value="">— Skip —</option>
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
        disabled={status === "saving"}
        className={`mt-2 inline-flex h-12 items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          status === "saved"
            ? "bg-gold-600 text-ink-900"
            : "bg-crimson-700 text-white hover:bg-crimson-600"
        }`}
      >
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved ✓"
            : "Save"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-200">{label}</span>
      {children}
    </label>
  );
}

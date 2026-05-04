"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  COURSE_ID_HINT,
  isFduEmail,
  isValidCourseId,
  type ClassContext,
} from "@/lib/auth";

export function ClassSelector({
  initialClass,
}: {
  initialClass: ClassContext | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ClassContext | null>(initialClass);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState(initialClass?.course_id ?? "");
  const [courseName, setCourseName] = useState(initialClass?.course_name ?? "");
  const [professorName, setProfessorName] = useState(
    initialClass?.professor_name ?? ""
  );
  const [professorEmail, setProfessorEmail] = useState(
    initialClass?.professor_email ?? ""
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = previousOverflow;
      };
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openDialog() {
    setError(null);
    setCourseId(current?.course_id ?? "");
    setCourseName(current?.course_name ?? "");
    setProfessorName(current?.professor_name ?? "");
    setProfessorEmail(current?.professor_email ?? "");
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const id = courseId.trim().toUpperCase();
    if (!isValidCourseId(id)) {
      setError("Course ID must look like ACCT_3220_01.");
      return;
    }
    if (!courseName.trim()) {
      setError("Add the course name (e.g. 'Intermediate Financial Accounting II').");
      return;
    }
    if (!professorName.trim()) {
      setError("Add your professor's name.");
      return;
    }
    const email = professorEmail.trim().toLowerCase();
    if (!isFduEmail(email)) {
      setError("Professor email must end with @fdu.edu or @student.fdu.edu.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/profile/class", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: id,
        course_name: courseName.trim(),
        professor_name: professorName.trim(),
        professor_email: email,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status})`);
      return;
    }

    setCurrent({
      course_id: id,
      course_name: courseName.trim(),
      professor_name: professorName.trim(),
      professor_email: email,
    });
    setOpen(false);
    router.refresh();
  }

  async function handleClear() {
    setSubmitting(true);
    await fetch("/api/profile/class", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: null,
        course_name: null,
        professor_name: null,
        professor_email: null,
      }),
    });
    setSubmitting(false);
    setCurrent(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
          current
            ? "border-gold-700/40 bg-gold-900/15 text-gold-200 hover:border-gold-500"
            : "border-crimson-700/60 bg-crimson-900/20 text-crimson-200 hover:border-crimson-500"
        }`}
        title={
          current
            ? `${current.course_name} — Prof. ${current.professor_name}`
            : "Pick your class to share materials with classmates"
        }
      >
        <span aria-hidden>🎓</span>
        <span className="max-w-[140px] truncate">
          {current
            ? `${current.course_id} · ${shortName(current.professor_name)}`
            : "Pick your class"}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
          >
            <div className="mb-1 font-serif text-xl font-bold tracking-tight">
              Your current class
            </div>
            <p className="mb-5 text-xs text-ink-300">
              Files you upload while this class is active are shared with
              classmates who set the same course + professor. Your other
              materials stay private to you.
            </p>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <Field label="Course name">
                <input
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Intermediate Financial Accounting II"
                  className={inputClass}
                />
              </Field>

              <Field label="Course ID" hint={COURSE_ID_HINT}>
                <input
                  required
                  value={courseId}
                  onChange={(e) =>
                    setCourseId(e.target.value.toUpperCase().replace(/\s/g, ""))
                  }
                  placeholder="ACCT_3220_01"
                  className={`${inputClass} font-mono uppercase tracking-wider`}
                />
              </Field>

              <Field label="Professor name">
                <input
                  required
                  value={professorName}
                  onChange={(e) => setProfessorName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  className={inputClass}
                />
              </Field>

              <Field label="Professor email">
                <input
                  required
                  type="email"
                  value={professorEmail}
                  onChange={(e) => setProfessorEmail(e.target.value)}
                  placeholder="jsmith@fdu.edu"
                  className={inputClass}
                />
              </Field>

              {error && (
                <p className="rounded-lg border border-crimson-700/60 bg-crimson-900/20 px-3 py-2 text-sm text-crimson-200">
                  {error}
                </p>
              )}

              <div className="mt-1 flex items-center justify-between gap-3">
                {current ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={submitting}
                    className="text-xs text-ink-400 underline-offset-2 hover:text-crimson-300 hover:underline disabled:opacity-40"
                  >
                    Clear class
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-border px-4 py-2 text-sm text-ink-200 hover:border-ink-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-crimson-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `Prof. ${last}`;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30";

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
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-300">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

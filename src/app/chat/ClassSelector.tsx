"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  isValidCourseId,
  type ClassContext,
} from "@/lib/auth";
import {
  FACULTY_BY_DEPARTMENT,
  facultySlugFromEmail,
  getFacultyBySlug,
  syntheticFacultyEmail,
  type Department,
} from "@/lib/fdu-faculty";
import {
  COURSES_BY_DEPARTMENT,
  COURSE_DEPARTMENT_ORDER,
  formatCourseId,
  getCourseByCode,
  parseCourseId,
} from "@/lib/fdu-courses";

const OTHER_PROFESSOR_VALUE = "__other__";
const OTHER_COURSE_VALUE = "__other__";
const DEPARTMENT_ORDER: Department[] = [
  "Accounting",
  "Finance & Economics",
  "Management & Marketing",
];

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

  // courseSelection is a catalog code ("ACCT3242") OR OTHER_COURSE_VALUE.
  // courseSection is the section number ("01") — small text input.
  const [courseSelection, setCourseSelection] = useState<string>(() =>
    initialCourseSelection(initialClass)
  );
  const [courseSection, setCourseSection] = useState<string>(() =>
    initialCourseSection(initialClass)
  );
  // Manual-entry fallback fields for "Other / not listed" courses.
  const [otherCourseId, setOtherCourseId] = useState<string>(() =>
    initialOtherCourseId(initialClass)
  );
  const [otherCourseName, setOtherCourseName] = useState<string>(() =>
    initialOtherCourseName(initialClass)
  );

  // facultySelection is either a faculty slug from the static list, or
  // OTHER_PROFESSOR_VALUE meaning "type a name for an adjunct/visitor".
  const [facultySelection, setFacultySelection] = useState<string>(() =>
    initialFacultySelection(initialClass)
  );
  const [otherProfName, setOtherProfName] = useState(() =>
    initialOtherProfName(initialClass)
  );

  const isOtherCourse = courseSelection === OTHER_COURSE_VALUE;
  const selectedCourse = useMemo(
    () => (isOtherCourse ? null : getCourseByCode(courseSelection)),
    [courseSelection, isOtherCourse]
  );

  const isOther = facultySelection === OTHER_PROFESSOR_VALUE;
  const selectedFaculty = useMemo(
    () => (isOther ? null : getFacultyBySlug(facultySelection)),
    [facultySelection, isOther]
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
    setCourseSelection(initialCourseSelection(current));
    setCourseSection(initialCourseSection(current));
    setOtherCourseId(initialOtherCourseId(current));
    setOtherCourseName(initialOtherCourseName(current));
    setFacultySelection(initialFacultySelection(current));
    setOtherProfName(initialOtherProfName(current));
    setOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let resolvedCourseId: string;
    let resolvedCourseName: string;
    if (isOtherCourse) {
      const id = otherCourseId.trim().toUpperCase();
      if (!isValidCourseId(id)) {
        setError("Course ID must look like ACCT_3242_01.");
        return;
      }
      if (!otherCourseName.trim()) {
        setError("Add the course name.");
        return;
      }
      resolvedCourseId = id;
      resolvedCourseName = otherCourseName.trim();
    } else {
      if (!selectedCourse) {
        setError("Pick your course from the list.");
        return;
      }
      const cleanedSection = courseSection.replace(/\D/g, "");
      if (!cleanedSection) {
        setError("Enter your section number (e.g. 01).");
        return;
      }
      resolvedCourseId = formatCourseId(selectedCourse.code, cleanedSection);
      resolvedCourseName = selectedCourse.title;
    }

    let resolvedProfName: string;
    let resolvedProfEmail: string;
    if (isOther) {
      const typed = otherProfName.trim();
      if (!typed) {
        setError("Enter your professor's name.");
        return;
      }
      resolvedProfName = typed;
      // Synthetic email keyed off the typed name so the directory still has
      // a stable join key for adjuncts. Lowercased + spaces → dashes.
      resolvedProfEmail = `${typed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}@silberman.fdu`;
    } else {
      if (!selectedFaculty) {
        setError("Pick your professor from the list.");
        return;
      }
      resolvedProfName = selectedFaculty.name;
      resolvedProfEmail = syntheticFacultyEmail(selectedFaculty.slug);
    }

    setSubmitting(true);
    const res = await fetch("/api/profile/class", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: resolvedCourseId,
        course_name: resolvedCourseName,
        professor_name: resolvedProfName,
        professor_email: resolvedProfEmail,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Save failed (${res.status})`);
      return;
    }

    setCurrent({
      course_id: resolvedCourseId,
      course_name: resolvedCourseName,
      professor_name: resolvedProfName,
      professor_email: resolvedProfEmail,
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
        className={`inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition sm:max-w-[240px] ${
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
        <span className="truncate">
          {current
            ? `${current.course_id} · ${shortName(current.professor_name)}`
            : "Pick your class"}
        </span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="flex min-h-full items-center justify-center px-4 py-6"
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
              <Field label="Course">
                <select
                  required
                  value={courseSelection}
                  onChange={(e) => setCourseSelection(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="" disabled>
                    Pick your course…
                  </option>
                  {COURSE_DEPARTMENT_ORDER.map((dept) => {
                    const list = COURSES_BY_DEPARTMENT[dept];
                    if (!list || list.length === 0) return null;
                    return (
                      <optgroup key={dept} label={dept}>
                        {list.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.title}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  <option value={OTHER_COURSE_VALUE}>
                    Other / not listed (type below)
                  </option>
                </select>
                {selectedCourse && (
                  <span className="text-[11px] text-ink-400">
                    {selectedCourse.department} · {selectedCourse.credits} cr.
                  </span>
                )}
              </Field>

              {!isOtherCourse && (
                <Field label="Section">
                  <input
                    required
                    inputMode="numeric"
                    pattern="\d{1,2}"
                    maxLength={2}
                    value={courseSection}
                    onChange={(e) =>
                      setCourseSection(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="01"
                    className={`${inputClass} font-mono`}
                  />
                </Field>
              )}

              {isOtherCourse && (
                <>
                  <Field label="Course ID" hint="Format: DEPT_####_##">
                    <input
                      required
                      value={otherCourseId}
                      onChange={(e) =>
                        setOtherCourseId(
                          e.target.value.toUpperCase().replace(/\s/g, "")
                        )
                      }
                      placeholder="ACCT_3242_01"
                      className={`${inputClass} font-mono uppercase tracking-wider`}
                    />
                  </Field>
                  <Field label="Course name">
                    <input
                      required
                      value={otherCourseName}
                      onChange={(e) => setOtherCourseName(e.target.value)}
                      placeholder="Intermediate Financial Accounting II"
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              <Field label="Professor">
                <select
                  required
                  value={facultySelection}
                  onChange={(e) => setFacultySelection(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="" disabled>
                    Pick your professor…
                  </option>
                  {DEPARTMENT_ORDER.map((dept) => (
                    <optgroup key={dept} label={dept}>
                      {FACULTY_BY_DEPARTMENT[dept].map((f) => (
                        <option key={f.slug} value={f.slug}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={OTHER_PROFESSOR_VALUE}>
                    Other / not listed (type below)
                  </option>
                </select>
                {selectedFaculty && (
                  <span className="text-[11px] text-ink-400">
                    {selectedFaculty.title}
                  </span>
                )}
              </Field>

              {isOther && (
                <Field label="Professor name">
                  <input
                    required
                    value={otherProfName}
                    onChange={(e) => setOtherProfName(e.target.value)}
                    placeholder="e.g. Dr. Jane Smith"
                    className={inputClass}
                  />
                </Field>
              )}

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
        </div>,
        document.body
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

function initialFacultySelection(c: ClassContext | null): string {
  if (!c?.professor_email) return "";
  const slug = facultySlugFromEmail(c.professor_email);
  if (slug && getFacultyBySlug(slug)) return slug;
  return OTHER_PROFESSOR_VALUE;
}

function initialOtherProfName(c: ClassContext | null): string {
  if (!c?.professor_email) return "";
  const slug = facultySlugFromEmail(c.professor_email);
  if (slug && getFacultyBySlug(slug)) return ""; // is a known faculty
  return c.professor_name ?? "";
}

function initialCourseSelection(c: ClassContext | null): string {
  if (!c?.course_id) return "";
  const parsed = parseCourseId(c.course_id);
  if (parsed && getCourseByCode(parsed.code)) return parsed.code;
  return OTHER_COURSE_VALUE;
}

function initialCourseSection(c: ClassContext | null): string {
  if (!c?.course_id) return "";
  const parsed = parseCourseId(c.course_id);
  if (parsed && getCourseByCode(parsed.code)) return parsed.section;
  return "";
}

function initialOtherCourseId(c: ClassContext | null): string {
  if (!c?.course_id) return "";
  const parsed = parseCourseId(c.course_id);
  if (parsed && getCourseByCode(parsed.code)) return ""; // known catalog course
  return c.course_id;
}

function initialOtherCourseName(c: ClassContext | null): string {
  if (!c?.course_id) return "";
  const parsed = parseCourseId(c.course_id);
  if (parsed && getCourseByCode(parsed.code)) return ""; // known catalog course
  return c.course_name ?? "";
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

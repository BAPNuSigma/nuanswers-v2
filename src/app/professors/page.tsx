import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { isStaffSignedIn } from "@/lib/staff-auth";
import { StaffSignOutButton } from "@/components/StaffSignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  SILBERMAN_FACULTY,
  facultySlugFromEmail,
  syntheticFacultyEmail,
  type Department,
} from "@/lib/fdu-faculty";

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function ProfessorsPage({ searchParams }: Props) {
  if (!(await isStaffSignedIn())) {
    redirect("/staff-signin?next=/professors");
  }

  const { email } = await searchParams;
  const supabase = createAdminClient();

  // No email filter → directory view (list of all profs with summaries).
  if (!email) {
    return <ProfessorDirectory supabase={supabase} />;
  }

  const profEmail = email.trim().toLowerCase();
  const profSlug = facultySlugFromEmail(profEmail);
  const staticFaculty = profSlug
    ? SILBERMAN_FACULTY.find((f) => f.slug === profSlug) ?? null
    : null;

  // ---- aggregate stats for this professor's classes ----
  const sinceDays = 14;
  const sinceISO = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // All sessions tagged with this prof's email
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, user_id, course_name, course_id, started_at, message_count")
    .eq("professor_email", profEmail)
    .order("started_at", { ascending: false });

  const sessionsList = sessions ?? [];

  const uniqueStudents = new Set(sessionsList.map((s) => s.user_id)).size;
  const totalSessions = sessionsList.length;
  const totalMessages = sessionsList.reduce(
    (sum, s) => sum + (s.message_count ?? 0),
    0
  );

  // Files uploaded by this prof's students
  const { count: filesCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("professor_email", profEmail);

  // Active courses (distinct course_ids in this prof's sessions)
  const courses = new Map<string, { name: string; sessions: number }>();
  for (const s of sessionsList) {
    if (!s.course_id) continue;
    const cur = courses.get(s.course_id) ?? {
      name: s.course_name ?? s.course_id,
      sessions: 0,
    };
    cur.sessions += 1;
    courses.set(s.course_id, cur);
  }

  // Daily activity for the last N days (sessions started per day)
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < sinceDays; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dailyCounts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const s of sessionsList) {
    if (s.started_at < sinceISO) continue;
    const day = s.started_at.slice(0, 10);
    if (day in dailyCounts) dailyCounts[day]! += 1;
  }
  const dailySeries = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));

  // Pull recent USER messages + the profiles of every student in this prof's
  // sessions, so we can build a per-student "what are they asking" view.
  // Topic word cloud is computed from the same message pool.
  const sessionIds = sessionsList.map((s) => s.id);
  const recentMessages: Array<{
    session_id: string;
    user_id: string | null;
    content: string;
    created_at: string;
  }> = [];
  if (sessionIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("session_id, user_id, content, created_at")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(500);
    if (msgs) recentMessages.push(...msgs);
  }

  // Profile lookup: full_name + student_id for every student in these sessions.
  const userIdSet = new Set(sessionsList.map((s) => s.user_id).filter(Boolean) as string[]);
  const userIds = Array.from(userIdSet);
  const profilesByUserId = new Map<
    string,
    { full_name: string; student_id: string }
  >();
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, student_id")
      .in("id", userIds);
    for (const p of profs ?? []) {
      profilesByUserId.set(p.id as string, {
        full_name: p.full_name as string,
        student_id: p.student_id as string,
      });
    }
  }

  // Build per-student summaries: counts + last 3 questions + last active.
  type StudentSummary = {
    userId: string;
    fullName: string;
    studentId: string;
    sessions: number;
    messages: number;
    lastActive: string | null;
    courses: Set<string>;
    recentQuestions: Array<{ content: string; created_at: string }>;
  };
  const studentMap = new Map<string, StudentSummary>();
  for (const s of sessionsList) {
    if (!s.user_id) continue;
    let entry = studentMap.get(s.user_id);
    if (!entry) {
      const profile = profilesByUserId.get(s.user_id);
      entry = {
        userId: s.user_id,
        fullName: profile?.full_name ?? "(unknown student)",
        studentId: profile?.student_id ?? "—",
        sessions: 0,
        messages: 0,
        lastActive: null,
        courses: new Set(),
        recentQuestions: [],
      };
      studentMap.set(s.user_id, entry);
    }
    entry.sessions += 1;
    entry.messages += s.message_count ?? 0;
    if (s.course_name) entry.courses.add(s.course_name);
    if (!entry.lastActive || s.started_at > entry.lastActive) {
      entry.lastActive = s.started_at;
    }
  }
  // Attach last 3 questions per student (messages are already sorted desc).
  for (const m of recentMessages) {
    if (!m.user_id) continue;
    const entry = studentMap.get(m.user_id);
    if (!entry) continue;
    if (entry.recentQuestions.length >= 3) continue;
    entry.recentQuestions.push({
      content: m.content,
      created_at: m.created_at,
    });
  }
  const studentList = Array.from(studentMap.values()).sort((a, b) => {
    if (b.messages !== a.messages) return b.messages - a.messages;
    return a.fullName.localeCompare(b.fullName);
  });

  const topicWordCounts = new Map<string, number>();
  for (const m of recentMessages) {
    for (const word of extractTopicWords(m.content)) {
      topicWordCounts.set(word, (topicWordCounts.get(word) ?? 0) + 1);
    }
  }
  const topTopics = Array.from(topicWordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const isEmpty = totalSessions === 0;

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden truncate text-xs text-ink-300 sm:inline">
              Prof. view · {profEmail}
            </span>
            <Link
              href="/professors"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
            >
              ← All profs
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
            >
              Officer view
            </Link>
            <ThemeToggle />
            <StaffSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gold-400">
            {staticFaculty
              ? `${staticFaculty.department} · Silberman`
              : "Professor dashboard"}
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            {staticFaculty
              ? `${staticFaculty.name}'s students`
              : "Professor's students"}
          </h1>
          <p className="text-sm text-ink-300">
            {staticFaculty?.title
              ? `${staticFaculty.title}. `
              : ""}
            Activity from any session where a student selected this professor
            in &ldquo;Pick your class.&rdquo;
          </p>
        </div>

        {isEmpty ? (
          <EmptyState email={profEmail} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Students" value={uniqueStudents} />
              <Stat label="Tutoring sessions" value={totalSessions} />
              <Stat label="Messages exchanged" value={totalMessages} />
              <Stat label="Files uploaded" value={filesCount ?? 0} />
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-2">
                <h2 className="font-serif text-lg font-semibold">
                  Daily activity · last {sinceDays} days
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  Sessions started per day. Hover a bar for the date.
                </p>
                <DailyChart series={dailySeries} max={maxDaily} />
              </section>

              <section className="rounded-2xl border border-border bg-surface p-6">
                <h2 className="font-serif text-lg font-semibold">
                  Active courses
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  Sections where students named you.
                </p>
                {courses.size === 0 && (
                  <p className="mt-4 text-sm text-ink-300">
                    No course IDs set yet.
                  </p>
                )}
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  {Array.from(courses.entries())
                    .sort((a, b) => b[1].sessions - a[1].sessions)
                    .map(([courseId, info]) => (
                      <li
                        key={courseId}
                        className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="line-clamp-2 break-words font-medium text-foreground">
                            {info.name}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-ink-400">
                            {courseId}
                          </span>
                        </div>
                        <span className="flex-none text-xs font-medium text-gold-300">
                          {info.sessions}{" "}
                          {info.sessions === 1 ? "session" : "sessions"}
                        </span>
                      </li>
                    ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold">
                    Your students
                  </h2>
                  <span className="text-[11px] uppercase tracking-wider text-ink-400">
                    {studentList.length}{" "}
                    {studentList.length === 1 ? "student" : "students"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  Each student who has used the bot in a class tagged with you,
                  plus the last few questions they actually asked.
                </p>
                {studentList.length === 0 ? (
                  <p className="mt-4 text-sm text-ink-300">
                    No students yet.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {studentList.map((s) => {
                      const lastActiveLabel = s.lastActive
                        ? new Date(s.lastActive).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "never";
                      const courseLine = Array.from(s.courses).join(" · ");
                      return (
                        <li
                          key={s.userId}
                          className="rounded-xl border border-border/60 bg-surface-elevated p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-serif text-base font-semibold text-foreground">
                                {s.fullName}
                              </div>
                              <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-400">
                                ID {s.studentId}
                                {courseLine ? ` · ${courseLine}` : ""}
                              </div>
                            </div>
                            <div className="flex flex-none items-center gap-3 text-[11px] uppercase tracking-wider text-gold-300">
                              <span>
                                {s.sessions}{" "}
                                {s.sessions === 1 ? "session" : "sessions"}
                              </span>
                              <span>
                                {s.messages}{" "}
                                {s.messages === 1 ? "msg" : "msgs"}
                              </span>
                              <span className="text-ink-400">
                                {lastActiveLabel}
                              </span>
                            </div>
                          </div>
                          {s.recentQuestions.length > 0 && (
                            <ul className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3">
                              {s.recentQuestions.map((q, i) => (
                                <li
                                  key={i}
                                  className="text-xs leading-relaxed text-ink-200"
                                >
                                  <span className="text-ink-400">›</span>{" "}
                                  <span className="whitespace-pre-wrap break-words">
                                    {q.content}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-3">
                <h2 className="font-serif text-lg font-semibold">
                  What students are asking about
                </h2>
                <p className="mt-1 text-xs text-ink-400">
                  Most-mentioned terms in students&apos; recent questions
                  (filler words removed).
                </p>
                {topTopics.length === 0 && (
                  <p className="mt-4 text-sm text-ink-300">
                    Not enough data yet — students need to send a few messages
                    first.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {topTopics.map(([word, count]) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-ink-100"
                    >
                      {word}
                      <span className="rounded-full bg-gold-600/20 px-1.5 py-0.5 font-mono text-[10px] text-gold-300">
                        {count}
                      </span>
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <p className="mt-10 text-center text-xs text-ink-400">
              Data refreshes when this page loads. No student names or message
              content are shared on this page — only aggregate metrics.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-xs uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-bold text-foreground">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function DailyChart({
  series,
  max,
}: {
  series: { date: string; count: number }[];
  max: number;
}) {
  return (
    <div className="mt-5 flex h-40 items-end gap-1.5">
      {series.map((d) => {
        const heightPct = (d.count / max) * 100;
        const dt = new Date(d.date + "T00:00:00");
        const label = dt.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${label}: ${d.count} sessions`}
          >
            <div
              className={`w-full rounded-t-md transition group-hover:bg-gold-400 ${
                d.count === 0 ? "bg-border" : "bg-gold-600"
              }`}
              style={{ height: `${Math.max(2, heightPct)}%` }}
            />
            <span className="mt-1 text-[9px] text-ink-500">
              {label.split(" ")[1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ email }: { email: string }) {
  return (
    <div className="rounded-2xl border border-gold-700/40 bg-gold-900/15 p-8 text-center">
      <div className="font-serif text-xl text-gold-200">No data yet</div>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-200">
        Stats appear here once your students sign in to NuAnswers and select{" "}
        <span className="text-gold-300">{email}</span> as their professor in
        their class settings.
      </p>
      <p className="mx-auto mt-3 max-w-md text-xs text-ink-400">
        Share{" "}
        <span className="break-all font-mono">
          https://nuanswers-v2.vercel.app
        </span>{" "}
        with your class — students sign in with their FDU email, set their
        course + professor, and start chatting.
      </p>
    </div>
  );
}

type ProfessorSummary = {
  email: string;
  name: string;
  title: string | null;
  department: Department | "Other";
  sessions: number;
  students: Set<string>;
  courses: Set<string>;
};

async function ProfessorDirectory({
  supabase,
}: {
  supabase: ReturnType<typeof createAdminClient>;
}) {
  // Step 1: seed the directory from the static FDU Silberman faculty list so
  // every professor on staff appears whether students have used the bot
  // with them yet or not.
  const byEmail = new Map<string, ProfessorSummary>();
  for (const f of SILBERMAN_FACULTY) {
    const e = syntheticFacultyEmail(f.slug);
    byEmail.set(e, {
      email: e,
      name: f.name,
      title: f.title,
      department: f.department,
      sessions: 0,
      students: new Set(),
      courses: new Set(),
    });
  }

  // Step 2: layer in real chat_sessions activity. Sessions for a known
  // professor bump that prof's stats; sessions for an adjunct (synthetic
  // email keyed off a typed name) get added as a new "Other" entry.
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("user_id, professor_email, professor_name, course_id, course_name")
    .not("professor_email", "is", null);

  for (const s of sessions ?? []) {
    const e = (s.professor_email ?? "").toLowerCase();
    if (!e) continue;
    let entry = byEmail.get(e);
    if (!entry) {
      entry = {
        email: e,
        name: s.professor_name ?? "Unnamed professor",
        title: null,
        department: "Other",
        sessions: 0,
        students: new Set(),
        courses: new Set(),
      };
      byEmail.set(e, entry);
    }
    entry.sessions += 1;
    if (s.user_id) entry.students.add(s.user_id);
    if (s.course_id) entry.courses.add(s.course_id);
  }

  // Step 3: also include profs students set on their profile but who
  // haven't run a chat session yet (otherwise they'd be invisible).
  const { data: profileProfs } = await supabase
    .from("profiles")
    .select("current_professor_email, current_professor_name, current_course_id")
    .not("current_professor_email", "is", null);

  for (const p of profileProfs ?? []) {
    const e = (p.current_professor_email ?? "").toLowerCase();
    if (!e || byEmail.has(e)) continue;
    byEmail.set(e, {
      email: e,
      name: p.current_professor_name ?? "Unnamed professor",
      title: null,
      department: "Other",
      sessions: 0,
      students: new Set(),
      courses: p.current_course_id ? new Set([p.current_course_id]) : new Set(),
    });
  }

  // Group by department, sort: most-active first within department,
  // departments in canonical order with "Other" last.
  const directory = Array.from(byEmail.values());
  const groups = new Map<string, ProfessorSummary[]>();
  for (const p of directory) {
    const key = p.department;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;
      return a.name.localeCompare(b.name);
    });
  }
  const groupOrder: Array<Department | "Other"> = [
    "Accounting",
    "Finance & Economics",
    "Management & Marketing",
    "Other",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
            >
              Officer view
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
            >
              Tutor view
            </Link>
            <ThemeToggle />
            <StaffSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gold-400">
            Silberman College of Business
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Faculty directory
          </h1>
          <p className="text-sm text-ink-300">
            Click any professor to see their NuAnswers activity. Profs with
            no activity yet are listed at the bottom of each department.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {groupOrder.map((dept) => {
            const list = groups.get(dept) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={dept}>
                <h2 className="mb-3 font-serif text-lg font-semibold text-foreground">
                  {dept}
                  <span className="ml-2 text-xs text-ink-400">{list.length}</span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p) => {
                    const slug = facultySlugFromEmail(p.email);
                    const isStaticFaculty = !!slug;
                    const isActive = p.sessions > 0;
                    return (
                      <li key={p.email}>
                        <Link
                          href={`/professors?email=${encodeURIComponent(p.email)}`}
                          className={`block rounded-2xl border p-5 transition ${
                            isActive
                              ? "border-gold-700/50 bg-gold-900/10 hover:border-gold-500"
                              : "border-border bg-surface hover:border-gold-600 hover:bg-surface-elevated"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-serif text-base font-semibold leading-tight">
                                {p.name}
                              </div>
                              {p.title && (
                                <div className="mt-1 line-clamp-2 text-[11px] text-ink-400">
                                  {p.title}
                                </div>
                              )}
                              {!isStaticFaculty && (
                                <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-500">
                                  Adjunct / typed by student
                                </div>
                              )}
                            </div>
                            {isActive && (
                              <span
                                aria-hidden
                                className="mt-1 h-2 w-2 flex-none rounded-full bg-gold-400"
                                title="Has student activity"
                              />
                            )}
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <Mini label="Students" value={p.students.size} />
                            <Mini label="Sessions" value={p.sessions} />
                            <Mini label="Courses" value={p.courses.size} />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-xl font-bold text-foreground">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-ink-400">
        {label}
      </div>
    </div>
  );
}

const STOP_WORDS = new Set([
  "the","a","an","and","or","but","of","to","for","in","on","at","by",
  "is","are","was","were","be","been","being","do","does","did","done",
  "have","has","had","having","i","me","my","mine","you","your","yours",
  "we","our","ours","they","them","their","this","that","these","those",
  "it","its","what","which","who","whom","why","how","when","where",
  "if","then","than","so","just","really","also","very","not","no",
  "can","cant","cannot","could","would","should","will","wont","wouldnt",
  "yes","ok","okay","please","thanks","thank","help","need","want","know",
  "with","about","from","into","over","under","up","down","out","off",
  "as","like","one","two","some","any","all","more","most","much","many",
  "your","yours","through","because","since","while","still","yet",
  "explain","tell","show","walk","through","work","working","through",
]);

function extractTopicWords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    )
  );
}

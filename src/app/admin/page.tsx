import { redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/Wordmark";
import { isStaffSignedIn } from "@/lib/staff-auth";
import { StaffSignOutButton } from "@/components/StaffSignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

// Chapter rollup. Today every NuAnswers user is on the BAP Nu Sigma (FDU)
// chapter. As more chapters join we'll add a `chapter` column to profiles
// and aggregate by it; for now we hardcode the single chapter name so the
// table still tells a story.
const CURRENT_CHAPTER = "Nu Sigma · FDU";

export default async function AdminPage() {
  if (!(await isStaffSignedIn())) {
    redirect("/staff-signin?next=/admin");
  }

  // Service-role client bypasses RLS so we can aggregate across every user.
  // Safe here because the page is gated by isStaffSignedIn() above.
  const supabase = createAdminClient();

  // ---- counts ----
  const sinceDays = 30;
  const sinceISO = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    profilesRes,
    sessionsRes,
    messagesRes,
    documentsRes,
    professorsRes,
    eventsRes,
    recentMessagesRes,
    feedbackRes,
    thumbsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, created_at, current_course_id, campus, major", {
        count: "exact",
      }),
    supabase
      .from("chat_sessions")
      .select("id, user_id, started_at, message_count", { count: "exact" }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select("id, file_type, file_size_bytes", { count: "exact" }),
    supabase
      .from("documents")
      .select("professor_email")
      .not("professor_email", "is", null),
    supabase
      .from("analytics_events")
      .select("event_type, created_at")
      .gte("created_at", sinceISO),
    supabase
      .from("messages")
      .select("content, created_at, user_id, session_id")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("analytics_events")
      .select("metadata, created_at, user_id")
      .eq("event_type", "user_feedback_text")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("analytics_events")
      .select("metadata")
      .eq("event_type", "feedback_submitted"),
  ]);

  const totalStudents = profilesRes.count ?? 0;
  const totalSessions = sessionsRes.count ?? 0;
  const totalMessages = messagesRes.count ?? 0;
  const totalFiles = documentsRes.count ?? 0;

  const profiles = profilesRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const documents = documentsRes.data ?? [];
  const professorRows = professorsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const recentMessages = (recentMessagesRes.data ?? []) as Array<{
    content: string;
    created_at: string;
    user_id: string | null;
    session_id: string | null;
  }>;

  // Build lookups so the "Recent student questions" feed can show real
  // student names + which professor's class the question came from.
  const profileNameById = new Map<string, { full_name: string; student_id: string }>();
  for (const p of profiles as Array<{ id: string; full_name?: string; student_id?: string }>) {
    profileNameById.set(p.id, {
      full_name: p.full_name ?? "(unknown)",
      student_id: p.student_id ?? "—",
    });
  }
  // Pull session→prof+course for any session referenced by recent messages.
  const sessionContextById = new Map<
    string,
    { professor_name: string | null; course_name: string | null }
  >();
  const referencedSessionIds = Array.from(
    new Set(recentMessages.map((m) => m.session_id).filter(Boolean) as string[])
  );
  if (referencedSessionIds.length > 0) {
    const { data: ctx } = await supabase
      .from("chat_sessions")
      .select("id, professor_name, course_name")
      .in("id", referencedSessionIds);
    for (const row of ctx ?? []) {
      sessionContextById.set(row.id as string, {
        professor_name: (row.professor_name as string | null) ?? null,
        course_name: (row.course_name as string | null) ?? null,
      });
    }
  }
  const feedback = (feedbackRes.data ?? []) as Array<{
    metadata: { text?: string; path?: string | null } | null;
    created_at: string;
    user_id: string | null;
  }>;
  const thumbs = (thumbsRes.data ?? []) as Array<{
    metadata: { sentiment?: "up" | "down" } | null;
  }>;
  const thumbsUp = thumbs.filter((t) => t.metadata?.sentiment === "up").length;
  const thumbsDown = thumbs.filter(
    (t) => t.metadata?.sentiment === "down"
  ).length;
  const thumbsTotal = thumbsUp + thumbsDown;
  const helpfulPct =
    thumbsTotal > 0 ? Math.round((thumbsUp / thumbsTotal) * 100) : null;

  // Active students = anyone who started a session in the last 30 days.
  const activeUserIds = new Set<string>();
  for (const s of sessions) {
    if (s.started_at >= sinceISO && s.user_id) activeUserIds.add(s.user_id);
  }

  // Storage footprint
  const totalBytes = documents.reduce(
    (sum, d) => sum + (d.file_size_bytes ?? 0),
    0
  );

  // Distinct professors students have tagged
  const distinctProfs = new Set(
    professorRows
      .map((r) => (r.professor_email ?? "").toLowerCase())
      .filter(Boolean)
  );

  // Daily activity over `sinceDays`: count chat_message_sent events per day.
  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < sinceDays; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dailyCounts[d.toISOString().slice(0, 10)] = 0;
  }
  for (const e of events) {
    if (e.event_type !== "chat_message_sent") continue;
    const day = e.created_at.slice(0, 10);
    if (day in dailyCounts) dailyCounts[day]! += 1;
  }
  const dailySeries = Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  const maxDaily = Math.max(1, ...dailySeries.map((d) => d.count));

  // Campus + major breakdown
  const campusCounts = countBy(profiles, (p) => p.campus ?? "Unspecified");
  const majorCounts = countBy(profiles, (p) => p.major ?? "Unspecified");

  // File type mix
  const fileTypeCounts = countBy(documents, (d) => d.file_type ?? "other");

  // Top question topics
  const topicCounts = new Map<string, number>();
  for (const m of recentMessages) {
    for (const word of extractTopicWords(m.content ?? "")) {
      topicCounts.set(word, (topicCounts.get(word) ?? 0) + 1);
    }
  }
  const topTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ink-300 sm:inline">
              Officer view
            </span>
            <Link
              href="/professors"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
            >
              Professor view
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
            Chapter rollup
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            BAP officer dashboard
          </h1>
          <p className="text-sm text-ink-300">
            Aggregate adoption + engagement across every chapter using
            NuAnswers. Numbers update live on every page load.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Students enrolled"
            value={totalStudents}
            sublabel={`${activeUserIds.size} active in ${sinceDays}d`}
          />
          <Stat
            label="Tutoring sessions"
            value={totalSessions}
            sublabel="all time"
          />
          <Stat
            label="Messages exchanged"
            value={totalMessages}
            sublabel={
              helpfulPct !== null
                ? `${helpfulPct}% rated helpful`
                : "student + tutor"
            }
          />
          <Stat
            label="Files indexed"
            value={totalFiles}
            sublabel={formatBytes(totalBytes)}
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-2">
            <h2 className="font-serif text-lg font-semibold">
              Daily activity · last {sinceDays} days
            </h2>
            <p className="mt-1 text-xs text-ink-400">
              Chat messages sent per day across every chapter.
            </p>
            <DailyChart series={dailySeries} max={maxDaily} />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-lg font-semibold">Chapters</h2>
            <p className="mt-1 text-xs text-ink-400">
              One row per BAP chapter using the bot.
            </p>
            <ul className="mt-4 flex flex-col gap-3 text-sm">
              <li className="flex items-center justify-between gap-3 rounded-xl border border-gold-700/40 bg-gold-900/15 px-3 py-2">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {CURRENT_CHAPTER}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider text-gold-300">
                    Founding chapter · live
                  </span>
                </div>
                <span className="text-xs font-medium text-gold-200">
                  {totalStudents} students
                </span>
              </li>
              <li className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-[11px] uppercase tracking-wider text-ink-400">
                More chapters coming soon
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-lg font-semibold">By campus</h2>
            <BreakdownList counts={campusCounts} total={totalStudents} />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-lg font-semibold">By major</h2>
            <BreakdownList counts={majorCounts} total={totalStudents} />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-lg font-semibold">File types</h2>
            <p className="mt-1 text-xs text-ink-400">
              {distinctProfs.size} distinct{" "}
              {distinctProfs.size === 1 ? "professor" : "professors"} tagged on
              uploads.
            </p>
            <BreakdownList counts={fileTypeCounts} total={totalFiles} />
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold">
                Recent student questions
              </h2>
              <span className="text-[11px] uppercase tracking-wider text-ink-400">
                latest 30
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              The most recent things students actually asked the bot — with
              who asked, the class, and the professor.
            </p>
            {recentMessages.length === 0 ? (
              <p className="mt-4 text-sm text-ink-300">
                No student questions yet.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {recentMessages.slice(0, 30).map((m, i) => {
                  const profile = m.user_id
                    ? profileNameById.get(m.user_id)
                    : null;
                  const ctx = m.session_id
                    ? sessionContextById.get(m.session_id)
                    : null;
                  const when = new Date(m.created_at).toLocaleString(
                    undefined,
                    {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }
                  );
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-border/60 bg-surface-elevated px-4 py-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 text-[11px] uppercase tracking-wider">
                        <span className="font-semibold text-foreground">
                          {profile?.full_name ?? "(unknown student)"}
                          <span className="ml-2 font-normal text-ink-400">
                            ID {profile?.student_id ?? "—"}
                          </span>
                        </span>
                        <span className="text-ink-400">{when}</span>
                      </div>
                      {(ctx?.course_name || ctx?.professor_name) && (
                        <div className="mt-0.5 text-[11px] text-gold-300">
                          {ctx?.course_name ?? ""}
                          {ctx?.course_name && ctx?.professor_name ? " · " : ""}
                          {ctx?.professor_name
                            ? `Prof. ${ctx.professor_name}`
                            : ""}
                        </div>
                      )}
                      <p className="mt-2 whitespace-pre-wrap break-words text-foreground">
                        {m.content}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 lg:col-span-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold">
                Recent feedback from students
              </h2>
              <span className="text-[11px] uppercase tracking-wider text-ink-400">
                {thumbsUp}👍 · {thumbsDown}👎 on responses
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-400">
              Bug reports + suggestions students submitted via the &ldquo;Tell
              us&rdquo; link in the chat footer.
            </p>
            {feedback.length === 0 ? (
              <p className="mt-4 text-sm text-ink-300">
                No feedback yet. Students will leave notes here as they use the
                bot.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {feedback.map((f, i) => {
                  const date = new Date(f.created_at);
                  const text =
                    typeof f.metadata?.text === "string"
                      ? f.metadata.text
                      : "(no text)";
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-border/60 bg-surface-elevated px-4 py-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap break-words text-foreground">
                        {text}
                      </p>
                      <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-400">
                        {date.toLocaleString()}
                        {f.metadata?.path ? ` · from ${f.metadata.path}` : ""}
                      </p>
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
              Most-mentioned terms across the last 500 student messages
              (filler words removed).
            </p>
            {topTopics.length === 0 ? (
              <p className="mt-4 text-sm text-ink-300">
                Not enough chat data yet.
              </p>
            ) : (
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
            )}
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-ink-400">
          Officer view · {CURRENT_CHAPTER} · refreshed at{" "}
          {new Date().toLocaleString()}
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-xs uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl font-bold text-foreground">
        {value.toLocaleString()}
      </div>
      {sublabel && (
        <div className="mt-1 text-[11px] uppercase tracking-wider text-gold-300">
          {sublabel}
        </div>
      )}
    </div>
  );
}

function BreakdownList({
  counts,
  total,
}: {
  counts: Map<string, number>;
  total: number;
}) {
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || total === 0) {
    return (
      <p className="mt-4 text-sm text-ink-300">No data yet.</p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col gap-2 text-sm">
      {sorted.map(([key, count]) => {
        const pct = Math.round((count / total) * 100);
        return (
          <li key={key} className="flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2 text-xs">
              <span className="line-clamp-2 break-words font-medium text-foreground">
                {key}
              </span>
              <span className="flex-none text-ink-300">
                {count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-gold-600"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
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
            title={`${label}: ${d.count} messages`}
          >
            <div
              className={`w-full rounded-t-md transition group-hover:bg-gold-400 ${
                d.count === 0 ? "bg-border" : "bg-gold-600"
              }`}
              style={{ height: `${Math.max(2, heightPct)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
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
  "through","because","since","while","still","yet","explain","tell","show",
  "walk","work","working","hello","hi","hey","there","sure","right",
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

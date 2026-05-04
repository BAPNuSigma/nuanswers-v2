import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";

export default async function ProfessorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profEmail = (user.email ?? "").toLowerCase();
  if (!profEmail) redirect("/login");

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

  // Top topics — extract from analytics_events.metadata.text or fall back to
  // first user messages for prof's sessions
  const sessionIds = sessionsList.map((s) => s.id);
  const recentMessages: Array<{ session_id: string; content: string }> = [];
  if (sessionIds.length > 0) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("session_id, content")
      .in("session_id", sessionIds)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(200);
    if (msgs) recentMessages.push(...msgs);
  }
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
            <span className="hidden text-xs text-ink-300 sm:inline">
              Professor view · {profEmail}
            </span>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-gold-400">
            Professor dashboard
          </span>
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Your students on NuAnswers
          </h1>
          <p className="text-sm text-ink-300">
            Aggregated activity for any session where a student selected{" "}
            <span className="text-gold-300">{profEmail}</span> as their
            professor.
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
                        className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {info.name}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-ink-400">
                            {courseId}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gold-300">
                          {info.sessions}{" "}
                          {info.sessions === 1 ? "session" : "sessions"}
                        </span>
                      </li>
                    ))}
                </ul>
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
        Share <span className="font-mono">https://nuanswers-v2.vercel.app</span>{" "}
        with your class — students sign in with their FDU email, set their
        course + professor, and start chatting.
      </p>
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

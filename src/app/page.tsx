import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300; // refresh stats every 5 min

export default async function Home() {
  const stats = await fetchPublicStats();

  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-8">
          <Wordmark size="md" />
          <nav className="flex items-center gap-6 text-sm text-ink-300">
            <span className="hidden sm:inline">
              Beta Alpha Psi · Nu Sigma Chapter
            </span>
            <Link
              href="/chat"
              className="rounded-full bg-crimson-700 px-4 py-2 font-medium text-white transition hover:bg-crimson-600"
            >
              Start a chat
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* HERO */}
        <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center justify-center px-6 py-20 text-center sm:px-8 sm:py-28">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-700/50 bg-gold-900/20 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gold-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            1st place · Deloitte-sponsored BAP competition
          </div>

          <h1 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            The tutor that
            <br />
            <span className="text-gold-400">guides you to the answer</span>
            <br />
            <span className="text-ink-300">— never just gives it.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg text-ink-200 sm:text-xl">
            NuAnswers is a step-by-step AI tutor for accounting and finance
            students. It asks the right questions so you learn to solve problems
            yourself — not just copy answers.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/chat"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-crimson-700 px-7 text-base font-semibold text-white shadow-lg shadow-crimson-900/40 transition hover:bg-crimson-600"
            >
              Start a tutoring session
              <span
                aria-hidden
                className="transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <a
              href="#example"
              className="inline-flex h-12 items-center rounded-full border border-ink-500 px-6 text-base font-medium text-ink-100 transition hover:border-gold-500 hover:text-gold-300"
            >
              See an example
            </a>
          </div>

          <p className="mt-6 text-xs text-ink-400">
            Built for FDU students. Works on your phone.
          </p>
        </section>

        {/* SAMPLE CONVERSATION */}
        <section
          id="example"
          className="mx-auto w-full max-w-4xl px-6 py-12 sm:px-8 sm:py-20"
        >
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs uppercase tracking-widest text-gold-400">
              How a real session looks
            </p>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl">
              Walk through it together. Question by question.
            </h2>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-black/40 sm:p-8">
            <ConversationExample />
          </div>

          <p className="mt-6 text-center text-xs text-ink-400">
            The bot never says &ldquo;the answer is X.&rdquo; It nudges you
            until you find X yourself.
          </p>
        </section>

        {/* HOW IT'S DIFFERENT */}
        <section
          id="how-it-works"
          className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8"
        >
          <h2 className="mb-12 text-center font-serif text-3xl font-bold sm:text-4xl">
            How it&apos;s different
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Feature
              number="01"
              title="Ask one question at a time"
              body="The tutor breaks problems into small steps and waits for your response. No info-dumping."
            />
            <Feature
              number="02"
              title="No direct answers. Ever."
              body="Even if you beg. The goal is for you to actually learn it — so the answer sticks in your next exam."
            />
            <Feature
              number="03"
              title="Grounded in your course"
              body="Upload your syllabus, slides, photos of homework, and notes. The tutor uses your materials — not random internet sources."
            />
          </div>
        </section>

        {/* WHAT IT READS */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-12 sm:px-8 sm:pb-20">
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-10">
            <p className="text-xs uppercase tracking-widest text-gold-400">
              Bring your whole course
            </p>
            <h3 className="mt-3 font-serif text-2xl font-bold sm:text-3xl">
              Upload anything your professor gave you.
            </h3>
            <p className="mt-3 max-w-2xl text-sm text-ink-200 sm:text-base">
              The tutor reads PDFs, Word docs, PowerPoint slide decks, Excel
              spreadsheets, CSVs, plain text, and even photos of homework or
              the whiteboard. It uses every uploaded file to ground its
              questions in <em>your</em> course — not the internet.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <FilePill type="PDF" />
              <FilePill type="DOCX" />
              <FilePill type="PPTX" />
              <FilePill type="XLSX" />
              <FilePill type="CSV" />
              <FilePill type="TXT" />
              <FilePill type="JPG / PNG" />
            </div>
          </div>
        </section>

        {/* STATS */}
        {stats.totalStudents > 0 && (
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-8">
            <div className="rounded-2xl border border-gold-700/40 bg-gold-900/10 p-8 sm:p-12">
              <p className="text-center text-xs uppercase tracking-widest text-gold-300">
                Live from the chapter
              </p>
              <div className="mt-6 grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
                <BigStat label="Students" value={stats.totalStudents} />
                <BigStat label="Tutoring sessions" value={stats.totalSessions} />
                <BigStat
                  label="Questions answered"
                  value={stats.totalMessages}
                />
                <BigStat label="Files indexed" value={stats.totalFiles} />
              </div>
              <p className="mt-6 text-center text-xs text-ink-400">
                Updates every 5 minutes. Real students, real questions.
              </p>
            </div>
          </section>
        )}

        {/* FINAL CTA */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-24 text-center sm:px-8">
          <h2 className="font-serif text-3xl font-bold sm:text-4xl">
            Ready to actually learn it?
          </h2>
          <p className="mt-4 text-ink-200">
            FDU students sign in with their school email. Setup takes under a
            minute.
          </p>
          <Link
            href="/chat"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-crimson-700 px-7 text-base font-semibold text-white shadow-lg shadow-crimson-900/40 transition hover:bg-crimson-600"
          >
            Start a tutoring session →
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-ink-400 sm:flex-row sm:px-8">
          <p>
            © {new Date().getFullYear()} Beta Alpha Psi · Nu Sigma Chapter ·
            Fairleigh Dickinson University
          </p>
          <p>Built for students, by students.</p>
        </div>
      </footer>
    </div>
  );
}

type PublicStats = {
  totalStudents: number;
  totalSessions: number;
  totalMessages: number;
  totalFiles: number;
};

async function fetchPublicStats(): Promise<PublicStats> {
  try {
    const supabase = await createClient();
    const [profiles, sessions, messages, documents] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true }),
    ]);
    return {
      totalStudents: profiles.count ?? 0,
      totalSessions: sessions.count ?? 0,
      totalMessages: messages.count ?? 0,
      totalFiles: documents.count ?? 0,
    };
  } catch {
    return {
      totalStudents: 0,
      totalSessions: 0,
      totalMessages: 0,
      totalFiles: 0,
    };
  }
}

function Feature({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-6">
      <div className="font-mono text-xs tracking-wider text-gold-500">
        {number}
      </div>
      <h3 className="mt-3 font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-200">{body}</p>
    </div>
  );
}

function FilePill({ type }: { type: string }) {
  return (
    <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-elevated px-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-200">
      {type}
    </span>
  );
}

function BigStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-serif text-3xl font-bold text-gold-300 sm:text-4xl">
        {value.toLocaleString()}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-ink-300">
        {label}
      </div>
    </div>
  );
}

// Static example — the visual showcase of how the tutor works. Not pulled
// from live data because the homepage is unauthenticated. The dialogue is
// representative of the actual tutor's behavior on basic EPS.
function ConversationExample() {
  const turns: Array<{ role: "user" | "assistant"; text: string }> = [
    {
      role: "user",
      text: "How do I calculate basic EPS?",
    },
    {
      role: "assistant",
      text: "Great question — let's walk through it together. EPS tells us how much of a company's profit each share earns. To calculate it, what two numbers do you think we need from the financial statements?",
    },
    {
      role: "user",
      text: "net income and... shares?",
    },
    {
      role: "assistant",
      text: "You're on the right track! Specifically the weighted-average number of common shares outstanding. Now — which one do you think goes on top of the formula, and which on the bottom?",
    },
    {
      role: "user",
      text: "net income on top, shares on bottom",
    },
    {
      role: "assistant",
      text: "Exactly right. So basic EPS = Net Income ÷ Weighted-Average Common Shares. One thing we still need to handle though — what happens if the company has preferred stock dividends? Does net income there go straight to common shareholders?",
    },
  ];

  return (
    <ul className="flex flex-col gap-4">
      {turns.map((t, i) => (
        <li
          key={i}
          className={`flex ${t.role === "user" ? "justify-end" : "justify-start"} items-start gap-3`}
        >
          {t.role === "assistant" && (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crimson-700 font-serif text-sm font-bold text-gold-200">
              N
            </div>
          )}
          <div
            className={
              t.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gold-600/90 px-4 py-3 text-sm text-ink-900 sm:text-base"
                : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground sm:text-base"
            }
          >
            {t.text}
          </div>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
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
        <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-8 sm:py-28">
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
              href="#how-it-works"
              className="inline-flex h-12 items-center rounded-full border border-ink-500 px-6 text-base font-medium text-ink-100 transition hover:border-gold-500 hover:text-gold-300"
            >
              How it works
            </a>
          </div>

          <p className="mt-6 text-xs text-ink-400">
            Built for FDU students. Works on your phone.
          </p>
        </section>

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
              body="Upload your syllabus, slides, and notes. The tutor uses them — not random internet sources."
            />
          </div>
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

import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import type { TutoringHoursStatus } from "@/lib/tutoring-hours";

export function TutoringHoursBlocker({
  status,
  email,
}: {
  status: TutoringHoursStatus;
  email: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background bg-grain">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Wordmark size="sm" />
          </Link>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-gold-600 hover:text-gold-300"
              title={`Signed in as ${email}`}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-700/50 bg-gold-900/20 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gold-300">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
          In-person tutoring is happening right now
        </div>

        <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          The bot is on a coffee break.
        </h1>

        <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-200 sm:text-lg">
          BAP Nu Sigma holds in-person tutoring{" "}
          <span className="text-gold-300">{status.day}s 9:00–11:00 AM ET</span>.
          During that window the bot pauses so you get the human-tutor experience
          first.
        </p>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoTile
            label="Right now"
            value={`${status.day} · ${status.timeET} ET`}
          />
          <InfoTile
            label="Bot returns"
            value={status.windowEnd ?? "soon"}
          />
        </div>

        <p className="mt-10 text-sm text-ink-300">
          Come back after the in-person session ends. Your past chats and
          uploaded materials will be exactly where you left them.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium text-ink-100 transition hover:border-gold-600 hover:text-gold-300"
          >
            Back to home
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6">
        <p className="mx-auto max-w-4xl px-6 text-center text-xs text-ink-400 sm:px-8">
          Schedule set by Beta Alpha Psi · Nu Sigma Chapter · Fairleigh
          Dickinson University
        </p>
      </footer>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-left">
      <div className="text-xs uppercase tracking-widest text-ink-400">
        {label}
      </div>
      <div className="mt-1 font-serif text-xl font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

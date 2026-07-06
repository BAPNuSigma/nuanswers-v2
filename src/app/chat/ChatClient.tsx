"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { logEvent, newSessionId } from "@/lib/analytics";
import { MaterialsBar, type DocumentRow } from "./MaterialsBar";
import { ChatHistory } from "./ChatHistory";
import { ClassSelector } from "./ClassSelector";
import { professorLastName, type ClassContext } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DEFAULT_LEARNING_MODE,
  LEARNING_MODES,
  MODE_STORAGE_KEY,
  getModeInfo,
  isLearningMode,
  type LearningMode,
} from "@/lib/learning-modes";

// Starter questions students can tap on the welcome screen, grouped by topic
// so the screen feels like a real "what can this thing do?" menu instead of
// a hardcoded four. Each group title is a real FDU course area.
const STARTER_GROUPS: Array<{ title: string; questions: string[] }> = [
  {
    title: "Accounting basics",
    questions: [
      "Walk me through the accounting equation",
      "What's the difference between debits and credits?",
      "How do I record a journal entry for buying inventory on credit?",
    ],
  },
  {
    title: "Financial statements",
    questions: [
      "How do I calculate the current ratio?",
      "Help me build a basic income statement",
      "What's the difference between FIFO and LIFO?",
    ],
  },
  {
    title: "Cost & managerial",
    questions: [
      "How do I calculate straight-line depreciation?",
      "Walk me through a contribution margin problem",
      "What's the difference between fixed and variable costs?",
    ],
  },
  {
    title: "Finance",
    questions: [
      "How do I calculate basic EPS?",
      "Walk me through present value of a single cash flow",
      "What's WACC and why does it matter?",
    ],
  },
];

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type UIMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string }>;
};

type ChatClientProps = {
  userId: string;
  email: string;
  fullName: string;
  profileComplete: boolean;
  initialDocuments: DocumentRow[];
  initialSessionId: string | null;
  initialMessages: StoredMessage[];
  initialClass: ClassContext | null;
};

function storedToUIMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.map(
    (m) =>
      ({
        id: m.id,
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }) as unknown as UIMessage
  );
}

export function ChatClient({
  userId,
  email,
  fullName,
  profileComplete,
  initialDocuments,
  initialSessionId,
  initialMessages,
  initialClass,
}: ChatClientProps) {
  const clientSessionId = useMemo(() => newSessionId(), []);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Learning mode — how the tutor teaches (visual / classic / hands-on).
  // Kept in localStorage so it follows the student across sessions, and in
  // a ref so the chat transport always sends the latest value.
  const [learningMode, setLearningMode] = useState<LearningMode>(
    DEFAULT_LEARNING_MODE
  );
  const learningModeRef = useRef<LearningMode>(DEFAULT_LEARNING_MODE);
  learningModeRef.current = learningMode;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (isLearningMode(stored)) setLearningMode(stored);
    } catch {
      // localStorage unavailable (private browsing) — default stands.
    }
  }, []);

  // Day streak — consecutive days the student has opened the assistant.
  // Pure localStorage; resets if they skip a day.
  const [streak, setStreak] = useState(1);
  useEffect(() => {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
        "en-CA"
      );
      const raw = window.localStorage.getItem(STREAK_STORAGE_KEY);
      let next = 1;
      if (raw) {
        const saved = JSON.parse(raw) as { day?: string; count?: number };
        if (saved.day === today) next = saved.count || 1;
        else if (saved.day === yesterday) next = (saved.count || 0) + 1;
      }
      window.localStorage.setItem(
        STREAK_STORAGE_KEY,
        JSON.stringify({ day: today, count: next })
      );
      setStreak(next);
    } catch {
      // localStorage unavailable — streak just stays at 1.
    }
  }, []);

  function changeLearningMode(next: LearningMode) {
    if (next === learningModeRef.current) return;
    setLearningMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Non-fatal — mode still applies for this visit.
    }
    logEvent({
      event_type: "learning_mode_changed",
      user_id: userId,
      session_id: clientSessionId,
      metadata: { mode: next },
    });
  }
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessionId
  );
  const sessionIdRef = useRef<string | null>(initialSessionId);
  sessionIdRef.current = activeSessionId;

  // Custom transport that:
  //  (1) injects the current session_id into every chat request body
  //  (2) reads the x-session-id response header (set by the API when it
  //      creates a fresh session on first message) and stores it locally
  //      so subsequent messages stay in the same session.
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, body }) {
        return {
          body: {
            ...body,
            messages,
            sessionId: sessionIdRef.current,
            learningMode: learningModeRef.current,
          },
        };
      },
      fetch: async (input, init) => {
        const res = await fetch(input, init);
        const sid = res.headers.get("x-session-id");
        if (sid && sid !== sessionIdRef.current) {
          sessionIdRef.current = sid;
          setActiveSessionId(sid);
        }
        return res;
      },
    });
  }, []);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate the chat with the messages we loaded server-side.
  // Run once on mount or whenever the initialSessionId changes (i.e. user
  // navigated to a different session via URL).
  useEffect(() => {
    setMessages(storedToUIMessages(initialMessages));
    setActiveSessionId(initialSessionId);
    sessionIdRef.current = initialSessionId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId]);

  useEffect(() => {
    logEvent({
      event_type: "page_view",
      user_id: userId,
      session_id: clientSessionId,
      metadata: { page: "chat" },
    });
    logEvent({
      event_type: "session_start",
      user_id: userId,
      session_id: clientSessionId,
    });

    // Fire session_end when the user leaves the page or closes the tab.
    // pagehide is more reliable than beforeunload on iOS Safari.
    function emitSessionEnd() {
      logEvent({
        event_type: "session_end",
        user_id: userId,
        session_id: clientSessionId,
      });
    }
    window.addEventListener("pagehide", emitSessionEnd);
    return () => {
      window.removeEventListener("pagehide", emitSessionEnd);
      emitSessionEnd();
    };
  }, [clientSessionId, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const isResponding = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const userMessageCount = messages.filter((m) => m.role === "user").length;

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isResponding) return;
    logEvent({
      event_type: "chat_message_sent",
      user_id: userId,
      session_id: clientSessionId,
      metadata: { length: trimmed.length, mode: learningModeRef.current },
    });
    setInput("");
    await sendMessage({ text: trimmed });
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex-none border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <ModeSelector mode={learningMode} onChange={changeLearningMode} />
            <ClassSelector initialClass={initialClass} />
            <MaterialsBar
              initialDocuments={initialDocuments}
              defaultProfessorLastName={professorLastName(
                initialClass?.professor_name ?? null
              )}
            />
            <ChatHistory activeSessionId={activeSessionId} />
            <StreakChip streak={streak} />
            <ThemeToggle />
            <span className="hidden text-xs text-ink-300 md:inline">
              {fullName}
            </span>
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
        </div>
      </header>

      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {!profileComplete && !bannerDismissed && (
            <ProfileBanner onDismiss={() => setBannerDismissed(true)} />
          )}
          {!hasMessages && (
            <Welcome
              onPick={handleSend}
              mode={learningMode}
              onModeChange={changeLearningMode}
            />
          )}
          {hasMessages && (
            <ul className="flex flex-col gap-6">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m as UIMsg}
                  userId={userId}
                  clientSessionId={clientSessionId}
                />
              ))}
              {isResponding &&
                messages[messages.length - 1]?.role === "user" && (
                  <TypingIndicator />
                )}
            </ul>
          )}
          {error && (
            <div className="mt-6 rounded-xl border border-crimson-700/60 bg-crimson-900/20 p-4 text-sm text-crimson-200">
              Something went wrong: {error.message}
            </div>
          )}
        </div>
      </main>

      <footer className="flex-none border-t border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-4 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex w-full items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                rows={1}
                placeholder="Ask a question — NuAnswers will guide you, not answer for you."
                className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
                style={{ minHeight: "48px", maxHeight: "160px" }}
                disabled={isResponding}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isResponding}
              className="inline-flex h-12 items-center gap-1 rounded-2xl bg-crimson-700 px-5 font-semibold text-white transition hover:bg-crimson-600 hover:shadow-lg hover:shadow-crimson-900/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <div className="flex items-center justify-between pt-1">
            <SessionMomentum count={userMessageCount} />
            <FeedbackLink userId={userId} clientSessionId={clientSessionId} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProfileBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gold-700/40 bg-gold-900/15 p-4">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gold-600/20 font-serif text-sm font-bold text-gold-300">
        ★
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gold-100">
          Help BAP track chapter analytics
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-200">
          Tell us your grade, campus, and major. Takes 30 seconds. Optional but
          super helpful for our chapter reports.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Link
            href="/profile"
            className="inline-flex h-9 items-center rounded-full bg-gold-600 px-4 text-sm font-semibold text-ink-900 transition hover:bg-gold-500"
          >
            Complete profile →
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function Welcome({
  onPick,
  mode,
  onModeChange,
}: {
  onPick: (t: string) => void;
  mode: LearningMode;
  onModeChange: (m: LearningMode) => void;
}) {
  return (
    <div className="animate-rise flex flex-col items-center pt-6 text-center sm:pt-12">
      <Wordmark size="lg" />
      <p className="mt-6 max-w-xl text-lg text-ink-200">
        Hi — I&apos;m{" "}
        <span className="font-semibold text-foreground">NuAnswers</span>.
        I&apos;ll guide you through accounting and finance problems by asking
        the right questions. I won&apos;t give you the answer — you&apos;ll get
        there yourself.
      </p>

      <div className="mt-8 w-full">
        <p className="mb-3 text-xs uppercase tracking-widest text-ink-400">
          Choose your mode
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LEARNING_MODES.map((m) => {
            const active = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-3 transition hover:-translate-y-0.5 active:scale-95 ${
                  active
                    ? "border-gold-500 bg-gold-900/15 ring-2 ring-gold-600/30"
                    : "border-border bg-surface hover:border-gold-600 hover:bg-surface-elevated"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {m.emoji}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-gold-200" : "text-foreground"
                  }`}
                >
                  {m.label}
                </span>
                <span className="hidden text-[11px] leading-snug text-ink-300 sm:block">
                  {m.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid w-full gap-3 text-left sm:grid-cols-3">
        <TipCard
          step="1"
          title="Pick your class"
          body="Tap the 🎓 button at the top so NuAnswers knows your course + professor."
        />
        <TipCard
          step="2"
          title="Add your materials"
          body="Tap 📎 Materials to upload your syllabus, slides, or homework photos."
        />
        <TipCard
          step="3"
          title="Ask anything"
          body="NuAnswers will walk you through it one question at a time."
        />
      </div>

      <div className="mt-8 w-full">
        <p className="mb-3 text-xs uppercase tracking-widest text-ink-400">
          Or jump in with one of these
        </p>
        <div className="flex flex-col gap-5">
          {STARTER_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-widest text-gold-400">
                {group.title}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {group.questions.map((q) => (
                  <button
                    key={q}
                    onClick={() => onPick(q)}
                    className="rounded-xl border border-border bg-surface p-3 text-left text-sm text-ink-100 transition hover:-translate-y-0.5 hover:border-gold-600 hover:bg-surface-elevated active:scale-95"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STREAK_STORAGE_KEY = "nuanswers-streak";

/**
 * 🔥 N-day streak chip. Only appears from day 2 on — a streak of 1 is
 * just "you showed up," which isn't worth a badge.
 */
function StreakChip({ streak }: { streak: number }) {
  if (streak < 2) return null;
  return (
    <span
      className="animate-pop inline-flex h-8 items-center gap-1 rounded-full border border-gold-700/40 bg-gold-900/15 px-2.5 text-xs font-semibold text-gold-200"
      title={`${streak}-day streak — come back tomorrow to keep it going!`}
    >
      <span aria-hidden>🔥</span>
      {streak}
    </span>
  );
}

const MOMENTUM_TIERS = [
  { min: 6, label: "On fire", emoji: "🔥" },
  { min: 3, label: "In the zone", emoji: "🎯" },
  { min: 1, label: "Warming up", emoji: "⚡" },
];

/**
 * Session momentum meter — fills as the student works through questions
 * this session. Pure encouragement; no data leaves the page.
 */
function SessionMomentum({ count }: { count: number }) {
  if (count === 0) return <span />;
  const tier = MOMENTUM_TIERS.find((t) => count >= t.min) ?? MOMENTUM_TIERS[2];
  const pct = Math.min((count / 6) * 100, 100);
  return (
    <div
      className="flex items-center gap-2"
      title={`${count} question${count === 1 ? "" : "s"} this session`}
    >
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-elevated sm:w-24">
        <div
          className="h-full rounded-full bg-gold-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-medium text-gold-400">
        <span aria-hidden>{tier.emoji}</span> {tier.label}
      </span>
    </div>
  );
}

function ModeSelector({
  mode,
  onChange,
}: {
  mode: LearningMode;
  onChange: (m: LearningMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const info = getModeInfo(mode);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-ink-100 transition hover:border-gold-600 hover:text-gold-300"
        title={`Learning mode: ${info.label} — tap to switch`}
      >
        <span aria-hidden>{info.emoji}</span>
        <span className="hidden sm:inline">{info.label}</span>
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
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
              <div className="mb-1 font-serif text-xl font-bold tracking-tight">
                Choose your mode
              </div>
              <p className="mb-5 text-xs text-ink-300">
                How do you learn best? NuAnswers adapts its style to match.
                Switch anytime — even mid-problem.
              </p>

              <div className="flex flex-col gap-3">
                {LEARNING_MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-gold-500 bg-gold-900/15 ring-2 ring-gold-600/30"
                          : "border-border bg-surface-elevated hover:border-gold-600"
                      }`}
                    >
                      <span
                        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface text-xl"
                        aria-hidden
                      >
                        {m.emoji}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              active ? "text-gold-200" : "text-foreground"
                            }`}
                          >
                            {m.label}
                          </span>
                          <span className="text-[11px] italic text-ink-400">
                            “{m.tagline}”
                          </span>
                          {active && (
                            <span className="rounded-full bg-gold-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-300">
                              Active
                            </span>
                          )}
                        </span>
                        <span className="text-xs leading-relaxed text-ink-300">
                          {m.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function TipCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border/80 bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold-600/20 font-mono text-[11px] font-semibold text-gold-300">
          {step}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}

function MessageBubble({
  message,
  userId,
  clientSessionId,
}: {
  message: UIMsg;
  userId: string;
  clientSessionId: string;
}) {
  const isUser = message.role === "user";
  const text = (message.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  const [vote, setVote] = useState<"up" | "down" | null>(null);

  function castVote(sentiment: "up" | "down") {
    if (vote) return; // one vote per message
    setVote(sentiment);
    logEvent({
      event_type: "feedback_submitted",
      user_id: userId,
      session_id: clientSessionId,
      metadata: {
        sentiment,
        message_id: message.id,
        message_length: text.length,
      },
    });
  }

  return (
    <li
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-rise items-start gap-3`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crimson-700 font-serif text-sm font-bold text-gold-200">
          N
        </div>
      )}
      <div className="flex max-w-[85%] flex-col gap-1.5">
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-sm bg-gold-600/90 px-4 py-3 text-ink-900"
              : "rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-foreground"
          }
        >
          <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
        </div>
        {!isUser && text.trim().length > 0 && (
          <div className="flex items-center gap-2 pl-1 text-[11px] text-ink-400">
            {vote ? (
              <span className="text-ink-300">
                Thanks for the feedback
                {vote === "down" ? " — we'll use it to improve." : "!"}
              </span>
            ) : (
              <>
                <span>Was this helpful?</span>
                <button
                  type="button"
                  onClick={() => castVote("up")}
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-surface-elevated hover:text-gold-300"
                  aria-label="Helpful"
                  title="Helpful"
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => castVote("down")}
                  className="rounded-full px-1.5 py-0.5 transition hover:bg-surface-elevated hover:text-crimson-300"
                  aria-label="Not helpful"
                  title="Not helpful"
                >
                  👎
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function TypingIndicator() {
  return (
    <li className="animate-rise flex items-start gap-3">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crimson-700 font-serif text-sm font-bold text-gold-200">
        N
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
        <Dot delay="0ms" />
        <Dot delay="150ms" />
        <Dot delay="300ms" />
      </div>
    </li>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-2 w-2 animate-bounce rounded-full bg-ink-300"
      style={{ animationDelay: delay }}
    />
  );
}

function FeedbackLink({
  userId,
  clientSessionId,
}: {
  userId: string;
  clientSessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function closeModal() {
    setOpen(false);
    setTimeout(() => {
      setText("");
      setStatus("idle");
    }, 200);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("sending");
    await logEvent({
      event_type: "user_feedback_text",
      user_id: userId,
      session_id: clientSessionId,
      metadata: {
        text: trimmed,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
    });
    setStatus("sent");
    setTimeout(closeModal, 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-ink-400 underline-offset-2 hover:text-gold-300 hover:underline"
      >
        Found a bug or have an idea? Tell us.
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="flex min-h-full items-center justify-center px-4 py-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div className="font-serif text-xl font-bold tracking-tight">
                  Send feedback
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="-mr-2 -mt-2 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg text-ink-400 transition hover:bg-surface-elevated hover:text-ink-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="mb-4 text-xs text-ink-300">
                Bugs, weird responses, feature requests — anything. Goes
                straight to the chapter&apos;s officer dashboard.
              </p>

              {status === "sent" ? (
                <p className="rounded-lg border border-gold-700/40 bg-gold-900/15 px-3 py-3 text-sm text-gold-200">
                  Thanks — got it. We&apos;ll take a look.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <textarea
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={5}
                    placeholder="What happened, what did you expect, what would help…"
                    className="w-full resize-y rounded-xl border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-full border border-border px-4 py-2 text-sm text-ink-200 hover:border-ink-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!text.trim() || status === "sending"}
                      className="rounded-full bg-crimson-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {status === "sending" ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

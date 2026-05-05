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

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isResponding) return;
    logEvent({
      event_type: "chat_message_sent",
      user_id: userId,
      session_id: clientSessionId,
      metadata: { length: trimmed.length },
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
            <ClassSelector initialClass={initialClass} />
            <MaterialsBar
              initialDocuments={initialDocuments}
              defaultProfessorLastName={professorLastName(
                initialClass?.professor_name ?? null
              )}
            />
            <ChatHistory activeSessionId={activeSessionId} />
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
          {!hasMessages && <Welcome onPick={handleSend} />}
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
                placeholder="Ask a question — the tutor will guide you, not answer for you."
                className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-base text-foreground placeholder:text-ink-400 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/30"
                style={{ minHeight: "48px", maxHeight: "160px" }}
                disabled={isResponding}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isResponding}
              className="inline-flex h-12 items-center gap-1 rounded-2xl bg-crimson-700 px-5 font-semibold text-white transition hover:bg-crimson-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <div className="flex items-center justify-end pt-1">
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

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-6 text-center sm:pt-12">
      <Wordmark size="lg" />
      <p className="mt-6 max-w-xl text-lg text-ink-200">
        Hi — I&apos;m{" "}
        <span className="font-semibold text-foreground">NuAnswers</span>.
        I&apos;ll guide you through accounting and finance problems by asking
        the right questions. I won&apos;t give you the answer — you&apos;ll get
        there yourself.
      </p>

      <div className="mt-6 grid w-full gap-3 text-left sm:grid-cols-3">
        <TipCard
          step="1"
          title="Pick your class"
          body="Tap the 🎓 button at the top so the tutor knows your course + professor."
        />
        <TipCard
          step="2"
          title="Add your materials"
          body="Tap 📎 Materials to upload your syllabus, slides, or homework photos."
        />
        <TipCard
          step="3"
          title="Ask anything"
          body="The tutor will walk you through it one question at a time."
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
                    className="rounded-xl border border-border bg-surface p-3 text-left text-sm text-ink-100 transition hover:border-gold-600 hover:bg-surface-elevated"
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
      className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
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
    <li className="flex items-start gap-3">
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
                Bugs, weird tutor responses, feature requests — anything. Goes
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

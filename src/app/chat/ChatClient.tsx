"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { logEvent, newSessionId } from "@/lib/analytics";
import { MaterialsBar, type DocumentRow } from "./MaterialsBar";
import { ChatHistory } from "./ChatHistory";
import { ClassSelector } from "./ClassSelector";
import type { ClassContext } from "@/lib/auth";

const STARTER_QUESTIONS = [
  "How do I calculate the current ratio?",
  "Walk me through the accounting equation.",
  "What's the difference between FIFO and LIFO?",
  "How do I calculate straight-line depreciation?",
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <ClassSelector initialClass={initialClass} />
            <ChatHistory activeSessionId={activeSessionId} />
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

      <MaterialsBar initialDocuments={initialDocuments} />

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {!profileComplete && !bannerDismissed && (
            <ProfileBanner onDismiss={() => setBannerDismissed(true)} />
          )}
          {!hasMessages && <Welcome onPick={handleSend} />}
          {hasMessages && (
            <ul className="flex flex-col gap-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m as UIMsg} />
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

      <footer className="border-t border-border/60 bg-surface/60 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-4 sm:px-6"
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
    <div className="flex flex-col items-center pt-8 text-center sm:pt-16">
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
          Try one of these
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onPick(q)}
              className="rounded-xl border border-border bg-surface p-4 text-left text-sm text-ink-100 transition hover:border-gold-600 hover:bg-surface-elevated"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";
  const text = (message.parts ?? [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  return (
    <li
      className={`flex ${isUser ? "justify-end" : "justify-start"} items-start gap-3`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-crimson-700 font-serif text-sm font-bold text-gold-200">
          N
        </div>
      )}
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gold-600/90 px-4 py-3 text-ink-900"
            : "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-foreground"
        }
      >
        <p className="whitespace-pre-wrap text-base leading-relaxed">{text}</p>
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

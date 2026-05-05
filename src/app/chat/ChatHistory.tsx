"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SessionRow = {
  id: string;
  started_at: string;
  message_count: number;
  preview: string | null;
  course_name: string | null;
};

export function ChatHistory({
  activeSessionId,
}: {
  activeSessionId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleNewChat() {
    setOpen(false);
    router.push("/chat?new=1");
    router.refresh();
  }

  function handleOpenSession(id: string) {
    setOpen(false);
    router.push(`/chat?session=${id}`);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch {
      // ignore — refresh on next open
    }
    if (id === activeSessionId) {
      router.push("/chat?new=1");
      router.refresh();
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-ink-100 transition hover:border-gold-600 hover:text-gold-300"
        aria-label="Chat history"
      >
        <span aria-hidden>💬</span>
        Chats
        <span aria-hidden className="text-ink-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 border-b border-border bg-crimson-700/20 px-4 py-3 text-left text-sm font-semibold text-gold-100 transition hover:bg-crimson-700/30"
          >
            <span aria-hidden>＋</span> New chat
          </button>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-ink-400">
                Loading…
              </div>
            )}
            {!loading && sessions.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-ink-400">
                No past chats yet. Send a message to start one.
              </div>
            )}
            {!loading &&
              sessions.map((s) => {
                const label = s.preview?.trim() || "(empty chat)";
                const date = new Date(s.started_at);
                const dateStr = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                });
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    className={`group flex items-start gap-2 border-b border-border/40 px-3 py-2.5 text-left text-sm transition ${
                      isActive ? "bg-gold-900/15" : "hover:bg-surface-elevated"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenSession(s.id)}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    >
                      <span className="line-clamp-2 break-words text-ink-100">
                        {label}
                      </span>
                      <span className="line-clamp-1 text-[10px] uppercase tracking-wider text-ink-400">
                        {dateStr} · {s.message_count} msg
                        {s.course_name ? ` · ${s.course_name}` : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="flex-none rounded p-1 text-ink-500 opacity-0 transition hover:text-crimson-300 group-hover:opacity-100"
                      title="Delete chat"
                      aria-label="Delete chat"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

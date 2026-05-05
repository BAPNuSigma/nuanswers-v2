export type AnalyticsEventType =
  | "page_view"
  | "session_start"
  | "session_end"
  | "chat_message_sent"
  | "chat_response_received"
  | "file_uploaded"
  | "feedback_submitted"
  | "user_feedback_text"
  | "login"
  | "signup"
  | "tutoring_hours_blocked"
  | "error";

export type AnalyticsEvent = {
  event_type: AnalyticsEventType;
  session_id?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
};

type LoggedEvent = AnalyticsEvent & { timestamp: string };

export async function logEvent(event: AnalyticsEvent): Promise<void> {
  const payload: LoggedEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  if (typeof window === "undefined") {
    console.log("[analytics]", payload);
    return;
  }

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    console.warn("[analytics] failed to send", payload);
  }
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

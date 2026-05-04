/**
 * In-person tutoring schedule.
 * When the current time (Eastern Time) falls inside any of these windows,
 * the bot stops accepting new chats and tells students to attend in person.
 *
 * Mirrored from the original Streamlit NuAnswers.py — same Mon-Fri 9-11am ET
 * window the BAP Nu Sigma chapter holds in person.
 *
 * To disable temporarily (e.g. for a demo), set TUTORING_HOURS_DISABLED=true
 * in Vercel environment variables.
 */

type DayName =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

type Window = { start: string; end: string }; // "HH:MM" 24h

export const TUTORING_HOURS: Partial<Record<DayName, Window[]>> = {
  Monday: [{ start: "09:00", end: "11:00" }],
  Tuesday: [{ start: "09:00", end: "11:00" }],
  Wednesday: [{ start: "09:00", end: "11:00" }],
  Thursday: [{ start: "09:00", end: "11:00" }],
  Friday: [{ start: "09:00", end: "11:00" }],
};

export type TutoringHoursStatus = {
  active: boolean; // true when bot should be blocked
  day: string; // e.g. "Tuesday"
  timeET: string; // "10:30 AM"
  windowEnd?: string; // "11:00 AM" — only when active
  disabled: boolean; // env override
};

export function getTutoringHoursStatus(
  now: Date = new Date()
): TutoringHoursStatus {
  const disabled = process.env.TUTORING_HOURS_DISABLED === "true";

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });

  let day = "";
  let hour = 0;
  let minute = 0;
  for (const p of formatter.formatToParts(now)) {
    if (p.type === "weekday") day = p.value;
    else if (p.type === "hour") hour = parseInt(p.value, 10) || 0;
    else if (p.type === "minute") minute = parseInt(p.value, 10) || 0;
  }
  // Intl returns hour "24" at midnight in some locales; clamp.
  if (hour === 24) hour = 0;

  const windows = TUTORING_HOURS[day as DayName];
  const timeET = format12(hour, minute);

  if (disabled || !windows) {
    return { active: false, day, timeET, disabled };
  }

  const cur = hour * 60 + minute;
  for (const w of windows) {
    const [sh, sm] = w.start.split(":").map((n) => parseInt(n, 10));
    const [eh, em] = w.end.split(":").map((n) => parseInt(n, 10));
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (cur >= start && cur < end) {
      return {
        active: true,
        day,
        timeET,
        windowEnd: format12(eh, em),
        disabled: false,
      };
    }
  }

  return { active: false, day, timeET, disabled };
}

function format12(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

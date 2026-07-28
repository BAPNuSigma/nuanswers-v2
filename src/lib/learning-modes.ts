/**
 * Learning modes — the student picks how they learn best and the tutor
 * adapts its teaching style. Selected in the chat UI (header pill +
 * welcome-screen cards), persisted in localStorage, sent with every chat
 * request, and translated into extra system-prompt instructions server-side.
 *
 * The Socratic core (never give the answer) is identical in all modes —
 * modes only change HOW guidance is delivered, never how much is revealed.
 */

export type LearningMode = "auto" | "visual" | "verbal" | "hands_on";

export type LearningModeInfo = {
  id: LearningMode;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
};

export const LEARNING_MODES: LearningModeInfo[] = [
  {
    id: "auto",
    label: "Auto",
    emoji: "✨",
    tagline: "Pick for me",
    description:
      "NuAnswers reads each question and picks the best teaching style on its own.",
  },
  {
    id: "visual",
    label: "Visual",
    emoji: "🎨",
    tagline: "Show me",
    description:
      "T-accounts, mini tables, and laid-out steps — see the structure of every problem.",
  },
  {
    id: "verbal",
    label: "Classic",
    emoji: "💬",
    tagline: "Talk me through it",
    description:
      "Conversational back-and-forth — the classic one-question-at-a-time style.",
  },
  {
    id: "hands_on",
    label: "Hands-On",
    emoji: "🛠️",
    tagline: "Let me try",
    description:
      "Learn by doing — every step ends with a small task you work out yourself.",
  },
];

export const DEFAULT_LEARNING_MODE: LearningMode = "verbal";

export const MODE_STORAGE_KEY = "nuanswers-learning-mode";

export function isLearningMode(value: unknown): value is LearningMode {
  return (
    value === "auto" ||
    value === "visual" ||
    value === "verbal" ||
    value === "hands_on"
  );
}

export function getModeInfo(mode: LearningMode): LearningModeInfo {
  return LEARNING_MODES.find((m) => m.id === mode) ?? LEARNING_MODES[1];
}

/**
 * Appended to the system prompt AFTER the core tutoring rules, so the
 * base rules (especially never-give-the-answer) always win on conflict.
 */
export const MODE_PROMPT_INSTRUCTIONS: Record<LearningMode, string> = {
  auto: `## Active learning mode: AUTO ✨
The student asked NuAnswers to pick the teaching style per question. For EACH reply, silently choose the style that fits what they just asked:
- Structure-heavy topics (journal entries, T-accounts, financial statements, ratios with several inputs) → teach VISUALLY: small plain-text T-accounts, mini tables, or step maps, always with a "?" blank where the student's answer goes.
- Procedural or practice-oriented questions ("how do I…", "walk me through…", homework attempts) → teach HANDS-ON: end the reply with one tiny do-it-now task (compute one number, classify one account).
- Conceptual or definitional questions ("what is…", "why does…") → teach CLASSICALLY: plain conversational Socratic dialogue, no lists or tables.
Never announce which style you picked — just use it. All core rules still apply: one question at a time, NEVER reveal the answer, the final number, or the completed solution.`,

  visual: `## Active learning mode: VISUAL 🎨
The student chose Visual mode — they learn best when they can SEE the structure.
- When it clarifies a concept, lay it out visually in plain text: a T-account, a small two-column table, a timeline, or an indented step map.
- Put key relationships on their own line ("Assets = Liabilities + Equity") instead of burying them in a sentence.
- For this mode ONLY, the "no bullet lists" format rule is relaxed: small lists and plain-text diagrams are allowed when they teach structure. Keep them compact.
- Every diagram must contain the blank the student fills in — a "?" where their answer goes. NEVER a completed diagram, completed entry, or final number. All core rules still apply: one question at a time, never reveal the answer.`,

  verbal: `## Active learning mode: CLASSIC 💬
The student chose Classic mode — conversational guidance.
- Keep the default format rules exactly as written: short conversational replies, plain language, one question at a time, no lists or tables.
- Lean on relatable analogies and everyday language to explain concepts.`,

  hands_on: `## Active learning mode: HANDS-ON 🛠️
The student chose Hands-On mode — they learn by DOING.
- End every reply with ONE small, concrete task the student performs right now: compute one number, classify one account, write one line of an entry, or fill in one side of a T-account.
- Frame it as an action ("Grab your calculator and…", "Write out just the debit side…") rather than an abstract question.
- Keep tasks tiny — one calculation or one decision per message. If they're stuck, shrink the task even further.
- Never do the task for them. All core rules still apply: NEVER reveal the answer, the final number, or the completed solution.`,
};

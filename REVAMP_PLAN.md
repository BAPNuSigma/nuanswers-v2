# NuAnswers — Revamp Plan (hand-off to Fable)

> **How to use this file:** In a new session, tell the model:
> *"Read REVAMP_PLAN.md and start with Phase 1."*
> Work top to bottom. One phase at a time. Commit after each task.

---

## 0. READ ME FIRST — context (don't repeat this back)

**Who you're working with — Carlo:**
- Non-technical (accounting student, not a coder). Explain in plain English,
  define any technical term the first time you use it, number your steps.
- Reads on his phone: short paragraphs, no wide tables.

**The project — NuAnswers:**
- An AI Socratic tutor for FDU accounting/finance students, built by Beta Alpha
  Psi Nu Sigma. It guides students to answers; it must NEVER give them directly.
- Code: `/Users/betaalphapsisigmanu/nuanswers-v2`
- Deployed on Vercel. Data/auth/storage on Supabase (Postgres, Auth, Storage,
  pgvector for RAG).
- Deadline: demo-ready for BAP nationals, Baltimore, **end of July 2026** (~4 weeks).
  Live testers (Damien, Valerie) use it now, so **don't break working things.**

**Tech stack (don't waste time re-discovering):**
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (`@theme` in
  `src/app/globals.css`).
- The live tutor currently runs on **OpenAI** (`gpt-4.1` chat, `gpt-4o-mini`
  vision), NOT Claude.
- Staff dashboards (`/admin`, `/professors`) gated by one shared password.

### 🔴 HARD COST RULE — do not break this
**Do NOT switch the live tutor bot's model to Fable or any Claude model.**
The live model is billed per student message and scales with usage — too
expensive. The bot stays on OpenAI. Using Fable to *build/edit code* (this plan)
is fine and does not add per-message cost.

### Working rules (these save credits — follow strictly)
1. Always READ a file before editing it. Never guess at code.
2. Batch related edits into one turn instead of many small round-trips.
3. Don't explain Carlo's own codebase back to him — just do the work, then
   summarize what changed in 2–3 plain sentences.
4. Keep replies short unless he asks for detail.
5. Only ask a question if truly blocked. Otherwise make a sensible choice, do it,
   and note the assumption in one line.
6. Reuse existing components and patterns — don't invent new ones.
7. After each task: run the build, commit, and push. Don't leave work uncommitted.
8. Work turn by turn. Do NOT run long autonomous loops.

### The one rule that can never break (product behavior)
The bot must NEVER give a student the direct answer, final number, full journal
entry, or worked solution — even when begged or challenged. It guides with
questions. See `src/lib/tutoring-prompt.ts`.

---

## PHASE 1 — Bug fixes (do first, highest priority)

### 1a. Tutor sometimes gives away the answer when a student pushes back
**Status:** prompt already hardened; needs verification and possibly reinforcement.
**File:** `src/lib/tutoring-prompt.ts` (rules 2 & 3 + the BAD 2 / BAD 3 examples).

**The failure Valerie reported:** a student wrote a correct entry
("Dr. Cash 1000 / Cr. Dividend Revenue 1000"); the bot said "Close!" (implying
wrong) and then, when challenged "is 500*2 not 1000?", dumped the full journal
entry — handing over the answer.

**What to do:**
1. Re-read the current prompt. Confirm rules 2 (verify math, never call a correct
   answer "close") and 3 (confirm only the arithmetic asked about, never restate
   the full solution) are present and clear.
2. Test against these exact prompts and check the bot's behavior:
   - "Dr. cash 1000 / Cr. dividend revenue 1000" → must AFFIRM the math, then
     probe the credit-account choice. Must NOT say "close." Must NOT restate the
     entry.
   - "is 500*2 not 1000?" → confirm only "yes, 500×2=1000," then pivot to a
     question. Must NOT restate the full entry.
   - "so the answer is X right?" → redirect to a question, never confirm the full
     answer.
3. If it still misbehaves, strengthen the prompt (add a hard format rule: e.g.,
   "never output a complete journal entry, final number, or formula-with-values
   in a confirmation"). Do NOT switch models to fix this (see cost rule).

**Done when:** all three test prompts behave correctly on the live OpenAI model.

### 1b. "Class section still isn't working" save error
**Status:** unresolved. Diagnostic groundwork done — read before diving in.
**Files:** `src/app/chat/ClassSelector.tsx`, `src/app/api/profile/class/route.ts`,
`src/lib/fdu-courses.ts`, `src/lib/auth.ts`.

**What's already been traced (don't redo this):**
- A normal course flow with section "32" produces `formatCourseId("ACCT3242",
  "32")` → `"ACCT_3242_32"`, which passes `isValidCourseId`
  (`/^[A-Z]{3,5}_\d{4}_\d{2}$/`) and the API validation. So section "32" **by
  itself is not obviously the bug** — the section logic looks correct on paper.
- This means the real error Valerie hit may be a DIFFERENT field (e.g. professor
  not selected → "Pick a professor from the list") whose message was unreadable
  in her screenshot because of the (now-fixed) light-mode contrast bug.

**What to do:**
1. Reproduce first. Run the app locally (`npm run dev`), open the "Pick your
   class" modal, pick a course, type section "32", pick a professor, hit Save.
   Watch the network request to `PATCH /api/profile/class` and the exact error.
2. Trace which of the four validation gates actually fails (course, section,
   professor name, professor email). The error text now renders readably in both
   themes, so the message itself will point to the failing field.
3. Fix the real failing gate. Likely candidates to check: the "Other / not
   listed" professor path (synthetic email generation on lines ~152–155 of
   ClassSelector), or a course/professor left unselected.
4. If genuinely can't reproduce, add clearer per-field inline errors so the next
   report is unambiguous, and ask Carlo for one readable screenshot.

**Done when:** picking a catalog course + a 1–2 digit section + a professor saves
without error, and the saved class shows on the pill.

---

## PHASE 2 — Aesthetic polish (the "wow" for the projector)

**Goal:** make it look like a real product, not a class project, on a projector
at nationals. Keep the BAP crimson/black/gold branding.

**Screens, in priority order:**
1. **Chat screen** (`src/app/chat/*`) — the main demo surface.
2. **Landing page** (`src/app/page.tsx`).
3. **"Pick your class" modal** (`ClassSelector.tsx`).
4. **Dashboards** (`/admin`, `/professors`) — see Phase 3.

**Rules for this pass:**
- Use existing theme tokens in `src/app/globals.css` (crimson-*, gold-*, ink-*,
  surface/border). Don't hardcode hex values in components.
- **Every change must pass contrast in BOTH light and dark mode.** Valerie uses
  light mode and previously hit unreadable crimson-on-crimson text. Verify both
  themes after every visual edit.
- Tighten spacing, typography hierarchy, and consistency across screens.
- Do NOT redesign flows or rename things — this is polish, not a teardown.

**Done when:** all four screens look consistent and sharp in both themes, and the
build passes.

---

## PHASE 3 — Dashboard demo-readiness (judge-impressing)

**Files:** `src/app/admin/page.tsx`, `src/app/professors/page.tsx`.

**Goal:** these are the "wow, it has real analytics" moment for judges. Make them
clean and legible.
- Ensure per-student visibility reads well (email as primary identifier, actual
  questions asked, course/professor context).
- Charts and stat tiles legible in both themes.
- Nothing broken when there's little/no data (empty states).

**Done when:** both dashboards look demo-worthy and handle empty + populated data
gracefully in both themes.

---

## PHASE 4 — Code health (reliability, do last)

**Goal:** reduce bugs and make future changes safer. This is where a strong model
earns its keep — you can hold the whole codebase in mind.
1. Refactor/simplify duplicated or messy code across files (keep behavior
   identical).
2. Remove dead code and unused files.
3. Run a self-review pass for bugs and obvious security issues.
4. Confirm `npm run build` passes clean with no type errors.

**Done when:** build is green, no dead code, and a self-review found no
outstanding bugs.

---

## Definition of done (whole plan)
- Phase 1 bugs fixed and verified.
- Phases 2–3 look demo-ready in **both** light and dark mode.
- Phase 4 build passes clean.
- Every phase committed and pushed as you go.
- The live tutor still runs on OpenAI (cost rule never broken).

# NuAnswers Chapter Setup — Instructions for Claude

> **If you are a BAP member reading this:** you're almost done already.
> Install Claude Code (claude.com/claude-code), open it in this folder,
> and type: **"Read START-HERE.md and set up NuAnswers for my chapter."**
> Claude takes it from there. Everything below is written for Claude.

---

## Claude: your mission

You are helping a Beta Alpha Psi chapter deploy **NuAnswers** — an AI
teaching assistant for accounting and finance students, built by the
Nu Sigma chapter at Fairleigh Dickinson University. This folder contains
the complete, working source code. Your job is to get a copy running for
THIS chapter's school, customized to their campus.

## Who you're working with

Assume a smart accounting student with **zero coding background**.
- Plain English. Define every technical term the first time you use it.
- ONE step at a time. Confirm each step worked before the next.
- Do the technical work yourself (editing files, running commands)
  wherever you can; only send them to a website when a step needs their
  account or a credit card.
- Never ask them to paste secret keys into group chats or commit
  secrets to GitHub. Keys belong only in `.env.local` (which git
  ignores) and in Vercel's environment-variable settings.

## Hard rules (do not break these)

1. **Never weaken the tutoring rules** in `src/lib/tutoring-prompt.ts`.
   The assistant must never give students direct answers. That behavior
   is the product. Customize school names, never the pedagogy.
2. **Keep the AI on the configured OpenAI models** (`gpt-4.1` chat,
   `gpt-4o-mini` vision) unless the chapter explicitly asks and
   understands the cost. Do not wire in premium models by default.
3. **Don't invent shortcuts around auth.** School-email login and the
   staff password gate exist so professors can trust the data.

## The setup, phase by phase

Work through these in order. Before starting, ask the chapter for their
school name, business-school name, and student email domain (e.g.
`@rutgers.edu`) — you'll need them throughout.

### Phase 1 — Accounts (they do this, you guide)
They need: GitHub (free), Vercel (free Hobby), Supabase (free), and
OpenAI (platform.openai.com, ~$10 credit). Suggest a shared chapter
email so the setup survives officer turnover.

### Phase 2 — Database (Supabase)
1. Have them create a Supabase project named `nuanswers` (region near
   campus; save the database password).
2. Run the 4 SQL files in `supabase/migrations/` **in filename order**
   via the Supabase SQL Editor. Print each file's full contents for
   them to paste, or walk them through opening the files.
3. From Settings → API they'll need three values later: Project URL,
   anon public key, service_role secret.

### Phase 3 — Code on their GitHub
Get this folder into a **private** GitHub repository on their account.
If `git` and `gh` are available and authenticated, do it for them;
otherwise guide the GitHub web upload ("uploading an existing file" on
the empty-repo page accepts a dragged folder).
**Exclude any `.env.local`** if one exists — check first.

### Phase 4 — Deploy (Vercel)
Import the GitHub repo into Vercel. Before the first deploy, set these
environment variables (values from Phases 1-2):

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | their OpenAI key (sk-…) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role secret |
| `STAFF_PASSWORD` | a long passphrase they invent — gates /admin and /professors |

Deploy. Then in Supabase → Authentication → URL Configuration, set the
Site URL to the new Vercel URL and add
`https://THEIR-URL/auth/callback` as a redirect URL.

Note: `vercel.json` already schedules a daily ping to
`/api/keepalive` so the free-tier database never auto-pauses over
breaks. Nothing to configure — just tell them it's there.

### Phase 5 — Make it theirs (you do this, they answer questions)
Edit these files with their school's details:
1. `src/lib/auth.ts` — `isFduEmail()`: replace the FDU domains with
   their student-email domain(s).
2. `src/lib/fdu-faculty.ts` — replace with their business-school
   faculty (their school's public faculty directory page has the
   names/titles; keep the same data shape).
3. `src/lib/fdu-courses.ts` — replace with their accounting/finance
   course catalog (same `DEPT####` code pattern).
4. School/chapter names — search the project for `Nu Sigma` and
   `Fairleigh Dickinson` and swap in theirs (landing page, layout
   title, tutoring prompt, login page).
5. `src/lib/tutoring-hours.ts` — set their chapter's in-person
   tutoring schedule, or empty the schedule if they don't hold hours.
6. Optional: brand colors in `src/app/globals.css` (`@theme` block).
Commit and push — Vercel redeploys automatically.

### Phase 6 — Verify before you celebrate
Walk them through this checklist and confirm each item:
1. The site loads fast at their Vercel URL.
2. A student email gets a login code and signs in.
3. Chat: ask "what's the accounting equation?" — the assistant asks a
   guiding question back and does NOT lecture out the full answer.
4. A file upload succeeds and the assistant references it.
5. `/admin` bounces to the staff password page; the password works.
6. `/professors` shows their faculty directory.

When all six pass, they're live. Congratulate the chapter and remind
them: questions go to the BAP Nu Sigma chapter at FDU (ask for the
Head of AI).

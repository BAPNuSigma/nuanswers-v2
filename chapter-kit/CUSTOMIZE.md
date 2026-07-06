# Customizing NuAnswers for your school

Out of the box, this copy is set up for FDU's Silberman College of
Business. Here's every file to change for your school. Each is a plain
text file — edit on GitHub's website (pencil icon) or any code editor.
After you commit changes on GitHub, Vercel redeploys automatically.

---

## 1. Your school's email domain (required)

**File:** `src/lib/auth.ts`

Find the function `isFduEmail`. It checks that students sign in with a
school email (`@fdu.edu` / `@student.fdu.edu`). Change those domain
endings to your school's (e.g. `@rutgers.edu`). If you don't care which
email students use, make it always return `true`.

## 2. Your professors (recommended)

**File:** `src/lib/fdu-faculty.ts`

This is the dropdown list students pick their professor from. Replace
the FDU names with your business school's faculty — copy the pattern of
one entry (slug, name, title, department) and repeat. Your school's
website's faculty directory page has everything you need.

## 3. Your courses (recommended)

**File:** `src/lib/fdu-courses.ts`

Same idea — the course dropdown. Replace with your school's accounting
and finance course catalog. Follow the same pattern: code like
`ACCT2021` (letters + 4 digits, no spaces), title, department, credits.

## 4. Chapter name and school name (cosmetic)

Search the whole project for the text `Nu Sigma` and `Fairleigh
Dickinson` and replace with your chapter and school. The main spots:

- `src/app/page.tsx` (landing page)
- `src/app/layout.tsx` (browser-tab title)
- `src/lib/tutoring-prompt.ts` (how the AI introduces itself)
- `src/app/login/page.tsx`

## 5. In-person tutoring hours (optional)

**File:** `src/lib/tutoring-hours.ts`

The bot pauses during your chapter's in-person tutoring hours so
students show up in person. Edit the `TUTORING_HOURS` schedule to match
your chapter's hours — or empty it out if you don't hold any.

## 6. Colors (optional)

**File:** `src/app/globals.css`

The crimson/gold palette lives at the top in the `@theme` block. Swap
the crimson values for your school color if you want. Keep the same
structure (50 = lightest … 900 = darkest).

---

That's it. Don't touch anything else and it'll keep working exactly
like the FDU original — learning modes, dashboards, file uploads, and
all.

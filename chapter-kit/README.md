# NuAnswers Chapter Starter Kit

**From Beta Alpha Psi — Nu Sigma Chapter (Fairleigh Dickinson University)**

NuAnswers is an AI teaching assistant for accounting and finance students.
It guides students to answers with questions (never just gives the answer),
reads their uploaded course materials, and gives professors a private
dashboard showing exactly where their class needs help.

This kit lets YOUR chapter run its own copy. Total setup time: about an
hour. Total monthly cost: usually **$0** for hosting (free tiers) plus
OpenAI usage (typically a few dollars a month for a small chapter).

---

## What you need before starting

Three free accounts (sign up with a chapter email if you can, so the
setup survives officer transitions):

1. **GitHub** (github.com) — where the code lives
2. **Vercel** (vercel.com) — runs the website. Free "Hobby" plan is fine.
3. **Supabase** (supabase.com) — the database + student logins. Free plan is fine.

And one paid (but cheap) account:

4. **OpenAI** (platform.openai.com) — the AI brain. Pay-as-you-go;
   add $10 of credit to start.

---

## Setup, step by step

### Step 1 — Put the code on your GitHub

1. Create a GitHub account (or sign in).
2. Create a new **private** repository called `nuanswers`.
3. Upload the entire code folder from this USB (everything in the
   `nuanswers-v2` folder) to that repository. GitHub's website has an
   "uploading an existing file" link on the empty-repo page — you can
   drag the whole folder in.

### Step 2 — Create the database (Supabase)

1. Sign in to supabase.com and click **New project**. Name it
   `nuanswers`, pick a strong database password (save it somewhere),
   choose the region closest to your school.
2. When it finishes, go to **SQL Editor** (left sidebar).
3. On the USB, open the `supabase/migrations` folder. It has 4 files.
   Open each one in a text editor, copy ALL the text, paste it into the
   SQL Editor, and press **Run** — in this exact order:
   1. `2026-04-29-make-profile-fields-optional.sql`
   2. `2026-05-04-add-rag-tables.sql`
   3. `2026-05-04-course-context-and-sharing.sql`
   4. `2026-05-04-storage-uploads.sql`
4. Go to **Settings → API**. Keep this page open — you'll copy three
   values from it in Step 4.

### Step 3 — Get your OpenAI key

1. Sign in at platform.openai.com, add ~$10 of credit
   (Billing → Add payment method).
2. Go to **API keys → Create new secret key**. Copy it — it starts
   with `sk-`. You only see it once.

### Step 4 — Deploy the website (Vercel)

1. Sign in to vercel.com **with your GitHub account**.
2. Click **Add New → Project**, and import the `nuanswers` repository
   you made in Step 1.
3. Before clicking Deploy, expand **Environment Variables** and add
   these (name on the left, value on the right):

   | Name | Where the value comes from |
   |------|---------------------------|
   | `OPENAI_API_KEY` | Step 3 (starts with sk-) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings → API → anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API → service_role secret |
   | `STAFF_PASSWORD` | Make up a long passphrase — this is the door key to your officer + professor dashboards |

4. Click **Deploy**. In about two minutes you get a live URL like
   `nuanswers-yourchapter.vercel.app`.

### Step 5 — Connect logins back to your site

1. In Supabase go to **Authentication → URL Configuration**.
2. Set **Site URL** to your new Vercel URL.
3. Add `https://YOUR-VERCEL-URL/auth/callback` under **Redirect URLs**.

### Step 6 — Make it YOURS

Your copy still says FDU everywhere. Open `CUSTOMIZE.md` (next to this
file) — it lists the handful of files to edit for your school's name,
email domain, professors, and courses.

---

## Using it

- **Students** visit the URL, sign in with their school email, and chat.
- **Officers** visit `/admin`, **professors** visit `/professors` —
  both use the STAFF_PASSWORD you created.
- Students can pick a learning mode (Visual / Classic / Hands-On),
  upload materials, and the assistant guides without giving answers.

## If you get stuck

Contact the Nu Sigma chapter at FDU — we set this up and are happy to
help a fellow chapter. (Ask for the Head of AI.)

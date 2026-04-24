# NuAnswers v2

The AI tutor that guides you to the answer — never just gives it.

Built by Beta Alpha Psi · Nu Sigma Chapter · Fairleigh Dickinson University.

## Stack

- **Next.js 16** (App Router, React 19) — the web framework
- **Tailwind CSS 4** — styling
- **Vercel AI SDK 6** — streaming chat with OpenAI
- **OpenAI `gpt-4.1`** — the tutoring model (swappable to Claude later via one provider change)
- **TypeScript** — type safety

## Local setup (first time)

1. Install dependencies (only needed once, or after you pull new code):

   ```sh
   npm install
   ```

2. Create your local secrets file:

   ```sh
   cp .env.example .env.local
   ```

3. Open `.env.local` in a text editor and paste your real OpenAI API key after `OPENAI_API_KEY=`. Save the file. This file is ignored by git — it will never leave your computer.

4. Start the dev server:

   ```sh
   npm run dev
   ```

5. Open http://localhost:3000 in your browser. You should see the NuAnswers landing page. Click **Start a chat** to test the tutor.

## Project structure

```
src/
├── app/
│   ├── page.tsx              Landing page (/)
│   ├── layout.tsx            Root HTML shell + fonts
│   ├── globals.css           Tailwind + BAP color tokens
│   ├── chat/page.tsx         Chat UI (/chat)
│   └── api/
│       ├── chat/route.ts     Streaming chat endpoint
│       └── analytics/route.ts Event logging endpoint
├── components/
│   └── Wordmark.tsx          "NuAnswers" brand mark
└── lib/
    ├── tutoring-prompt.ts    System prompt enforcing tutoring rules
    └── analytics.ts          Event logging helper
```

## BAP color palette

Defined as Tailwind tokens in `src/app/globals.css`:

- `crimson-*` — primary action color (#8B0000 at 700)
- `gold-*` — accent, highlights (#C9A84C at 500)
- `ink-*` — text & surfaces (pure black #0F0F0F at 900, off-white #F5F5F5 at 50)

Use `bg-crimson-700`, `text-gold-400`, etc. in JSX.

## Deploy to Vercel

See the step-by-step deploy guide in the conversation with Claude — you'll push this repo to GitHub first, then connect it in Vercel.

## Roadmap

- [x] Landing page + branded chat with streaming tutor
- [ ] FDU email login + student accounts
- [ ] Course info form
- [ ] File upload (PDF, DOCX, PPTX, CSV, XLSX, images)
- [ ] RAG — tutor cites from uploaded course materials
- [ ] Tutoring hours blocker (Mon–Fri 9–11am ET)
- [ ] Session feedback collection
- [ ] Admin analytics dashboard
- [ ] Custom domain nuanswers.org

# Trigger
[![CI](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml/badge.svg)](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml)

Tell it what you're waiting for, in plain English, and it alerts you the moment it happens.

## Overview
- **Describe your condition**: type a plain-English sentence - "let me know when the rain clears up in Boston", "keep me posted if the England vs Ghana score becomes tied", "tell me when bitcoin drops below $80k".
- **Parsed automatically**: an LLM converts the prompt into a structured `{domain, subject, condition}` once, at creation time.
- **Checked on a schedule**: a scheduled job polls the right data source on an interval and evaluates the condition.
- **Notified the moment it's true**: a web push notification fires as soon as the condition is met.
- **Handled gracefully when unsupported**: prompts that don't map to a supported domain are saved as `unsupported` with a plain-English reason, rather than force-fit into the nearest one.

## How It Works
Supported domains, each backed by a free API:
- **Weather** - [Open-Meteo](https://open-meteo.com)
- **Sports** - [TheSportsDB](https://www.thesportsdb.com)
- **Crypto prices** - [CoinGecko](https://www.coingecko.com)

Polling runs on Supabase `pg_cron` + `pg_net`, calling a Supabase Edge Function on a timer - no server-side cron process needed. See [Tech Stack](#tech-stack) for the rest of the pipeline.

## Known Limitations
- **Polling is coarse, not real-time.** Alerts land within the poll window (every 15 minutes by default), not the instant the condition becomes true.
- **iOS push needs a home-screen install.** Safari only delivers web push to sites added to the home screen (Share → Add to Home Screen), not to a normal Safari tab.
- **Third-party APIs are free-tier and can rate-limit.** Open-Meteo, TheSportsDB, and CoinGecko are all called with no key or a shared free key. If a check starts failing (e.g. a 429 from a rate limit), the trigger shows a "⚠ check failing" badge on its dashboard card and the specific error on its detail page - this clears on its own once a poll succeeds again, no action needed.
- **Email confirmation depends on your Supabase Auth settings.** If "Confirm email" is enabled on the project, signing up won't sign the user in immediately - they'll see a message to check their inbox first.
- **Two known dependency CVEs are currently unpatched**, both because the fix requires a breaking major-version migration rather than a drop-in patch: `react-router-dom` 6.x has an open-redirect issue (`<Link>`/`useNavigate` with a backslash) and an SSR error-deserialization issue, fixed only in 7.18.0+; Vite's bundled `esbuild` has a moderate dev-server advisory, fixed only in Vite 8. Run `npm audit` for details. Neither is exploitable in this app's actual usage (no SSR, dev server isn't exposed publicly), but both are flagged here for visibility.

## Feature Backlog
- Generic web-crawling condition (BYOK LLM) for prompts outside the three built-in domains
- Gmail domain (new message from a given sender) - dropped from MVP to avoid the Google OAuth consent-screen setup and a token-encryption subsystem for a single domain
- Email notification channel (nodemailer)
- SMS via user-supplied Twilio key
- Domain override as a first-class dropdown at creation time
- ESPN's unofficial scoreboard API as a broader sports source

## Tech Stack
- **Frontend**: React + Vite, React Router
- **Backend**: Node.js + Express, serving the built frontend and the API from a single Render web service
- **Database / Auth**: Supabase (Postgres + Row Level Security, Supabase Auth with email/password)
- **Scheduling**: Supabase `pg_cron` + `pg_net`, calling a Supabase Edge Function on a timer - no server-side cron needed
- **LLM**: Groq (`llama-3.3-70b-versatile`) for one-time prompt parsing at trigger creation
- **Notifications**: Web Push (VAPID), self-hosted, no vendor
- **Deployment**: Render (free tier), same pattern as [jeopardy](../jeopardy) and [hivemind](../hivemind)
- **Tooling**: ESLint 9 (flat config) + Prettier for linting/formatting; GitHub Actions runs lint + build on every push/PR to `main`

## Local Development

### 1. Supabase project setup
1. Create a new project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) to create the tables, RLS policies, and (commented-out) `pg_cron` job.
3. Grab the project URL, anon key, and service role key from Project Settings → API.

### 2. Environment variables
Copy `.env.example` to `.env` and fill in the values described in [Environment Variables](#environment-variables). VAPID keys can be generated with `./node_modules/.bin/web-push generate-vapid-keys` after `npm install`.

### 3. Deploy the Edge Function
```bash
supabase functions deploy evaluate-triggers --project-ref <your-project-ref>
supabase secrets set --project-ref <your-project-ref> \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... VAPID_SUBJECT=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SHARED_SECRET=... SPORTSDB_API_KEY=3
```
Then uncomment and run the `cron.schedule(...)` block at the bottom of `schema.sql` (with the real project ref, service role key, and cron secret filled in) to start the 15-minute poll.

### 4. Run the app
```bash
npm install
npm run dev
```
Frontend on `http://localhost:5173`, API on `http://localhost:3001`.

## Scripts
- `npm run dev` - frontend + backend concurrently, with reload
- `npm run build` - production frontend build (`dist/`)
- `npm start` - serve the built frontend + API (used by Render)
- `npm run lint` - ESLint over the whole repo
- `npm run format` - Prettier, writes fixes in place

## Testing & CI
No automated test suite yet. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs `npm run lint` and `npm run build` on every push and PR to `main`.

## Deployment

### Blueprint
1. New → Blueprint on Render, point it at the `trigger` GitHub repo.
2. Render creates one free web service. Fill in the `sync: false` environment variables in the dashboard (same values as your local `.env` - set `BASE_URL`/`CLIENT_URL`/`VITE_API_URL` to the deployed Render URL instead of localhost).
3. `CRON_SHARED_SECRET` is auto-generated by Render if left blank - if you already deployed the Edge Function with your local value, paste that in instead so they match.

### Manual Web Service
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Runtime: Node 22+
- Set env vars per [Environment Variables](#environment-variables), using the deployed Render URL instead of localhost for `BASE_URL`/`CLIENT_URL`/`VITE_API_URL`.

## Environment Variables
Full defaults and comments are in [`.env.example`](.env.example).

- `PORT` - backend port (default `3001`).
- `BASE_URL` - public URL of the backend.
- `CLIENT_URL` - allowed frontend origin.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` - Supabase project URL and anon key, read by the frontend.
- `VITE_API_URL` - backend URL the frontend calls in local development.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - server-only Supabase project URL and `service_role` key (Settings → API). Bypasses RLS by design - never expose it client-side.
- `GROQ_API_KEY` - free key from [console.groq.com](https://console.groq.com), used to parse trigger prompts.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VITE_VAPID_PUBLIC_KEY` - Web Push keys, generate with `npx web-push generate-vapid-keys`.
- `VAPID_SUBJECT` - contact URI (`mailto:you@example.com`) sent with push subscriptions.
- `SPORTSDB_API_KEY` - TheSportsDB key; the free test key `3` works out of the box.
- `CRON_SHARED_SECRET` - random string shared between the Edge Function and the `pg_cron` job that calls it.

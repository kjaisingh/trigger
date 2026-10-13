# Trigger

[![CI](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml/badge.svg)](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml)

Trigger turns a plain-English request into a weather, sports, or crypto alert. You review and edit the parsed condition before saving it. A Supabase scheduled function checks active triggers every 15 minutes and sends browser push notifications when a condition fires. Alerts are not real time.

## What it supports

| Domain  | Data source                                | Metrics                                                              |
| ------- | ------------------------------------------ | -------------------------------------------------------------------- |
| Weather | [Open-Meteo](https://open-meteo.com)       | Temperature (°F), precipitation (mm), wind (mph), snowfall (cm)      |
| Sports  | [TheSportsDB](https://www.thesportsdb.com) | Team score, opponent score, score difference for a live scored match |
| Crypto  | [CoinGecko](https://www.coingecko.com)     | USD price                                                            |

A level trigger fires on each check while its condition is true if recurring is enabled. An edge trigger first records a baseline, then fires only when the condition changes from false to true. A one-time trigger becomes `fired` after its first match. Unsupported requests can be saved for reference, but are not monitored. Push delivery requires an enabled subscription on the device; history records when a condition fired even if no push reached a device.

Sports scores depend on the provider exposing a scored live event. Completed games and fixtures without scores do not fire alerts. Free data sources can rate limit or delay updates. The 15-minute schedule adds up to one polling interval of delay, plus provider and push delivery latency.

## Architecture

- React/Vite client and Express API run together on Render. Supabase Auth handles email/password sign-in; the API checks the user's bearer token.
- Supabase Postgres stores triggers, events, and push subscriptions. Row level security protects user data; the server and Edge Function use a service role key.
- Supabase `pg_cron` and `pg_net` invoke `evaluate-triggers`. This runs independently of the Render web service. Groq parses a prompt once when you create a trigger; evaluation uses deterministic comparisons.
- Web Push uses a VAPID key pair. The app can be installed from its web manifest. On iPhone, push requires adding the site to the Home Screen.

## Local setup

1. Install Node.js 22.12 or newer, the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), and a Supabase project. Run [`supabase/schema.sql`](supabase/schema.sql) in the project's SQL editor. It creates tables, indexes, and RLS policies; run it once for a new project.
2. Run `npm ci`. Copy `.env.example` to `.env` and fill in Supabase URL and keys, a [Groq API key](https://console.groq.com), and VAPID keys from `npx web-push generate-vapid-keys`. Use the same VAPID public key in `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY`. The service role and private VAPID keys must stay server-side.
3. Run `npm run dev`. Open `http://localhost:5173`; the API runs at `http://localhost:3001`. `CLIENT_URL` allows the local Vite origin; `VITE_API_URL` points the client to the local API. Supabase's scheduled evaluator is separate, so creating a trigger locally does not start local polling.
4. In the app, sign up, create a trigger, then enable push in Settings. Browser push needs HTTPS or localhost and browser permission.

## Deploy

1. Create a Render Blueprint from [`render.yaml`](render.yaml), or create one Node web service with build command `npm ci && npm run build`, start command `npm start`, and health check `/api/health`. Fill in the service's Supabase, Groq, and VAPID environment variables. The frontend and API share an origin on Render, so `VITE_API_URL` and `CLIENT_URL` are not needed there. `VITE_*` values are embedded during build; changing them requires a rebuild.
2. Set Edge Function secrets with the same VAPID key pair and a new random `CRON_SHARED_SECRET`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Then deploy the function:

   ```bash
   supabase secrets set --project-ref <project-ref> VAPID_SUBJECT=mailto:you@example.com VAPID_PUBLIC_KEY=<public-key> VAPID_PRIVATE_KEY=<private-key> CRON_SHARED_SECRET=<random-secret> SPORTSDB_API_KEY=3
   supabase functions deploy evaluate-triggers --project-ref <project-ref>
   ```

3. Edit the commented `cron.schedule` block at the end of [`supabase/schema.sql`](supabase/schema.sql): enter the project ref, service role key, and the same cron secret, then run that block in the Supabase SQL editor. Keep these credentials out of Git. It schedules a check every 15 minutes.
4. Check `/api/health`, sign in, send a test notification from Settings, and inspect a trigger's Last checked and History fields after a scheduled run. Render deployment does **not** deploy the Supabase function or SQL; repeat function deployment after changing its code.

## Configuration

[`.env.example`](.env.example) lists local variables. Render's Blueprint lists deployed web-service variables. `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and `VAPID_PRIVATE_KEY` are secrets. `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY` are intentionally public. The Edge Function additionally needs `CRON_SHARED_SECRET` (not the Render service). `SPORTSDB_API_KEY` defaults to the free test key `3`.
`GROQ_MODEL` is optional and defaults to `llama-3.1-8b-instant`; choose a model available to your Groq account if it changes.

## Checks

```bash
npm ci
npm audit --audit-level=moderate
npm run format:check
npm run lint
npm test
npm run build
deno check supabase/functions/evaluate-triggers/index.ts
```

GitHub Actions runs these checks on pushes and pull requests to `main`. Dependabot proposes weekly npm and Actions updates. `npm run format` writes Prettier changes. The API's unauthenticated health check is `/api/health`.

## Current limits

- Only push notifications are implemented. Notification permission and subscription are per device; Settings controls the current device.
- One global 15-minute schedule checks active triggers. Provider freshness and rate limits can delay or prevent a check. Check errors appear on the trigger card and detail page.
- The free TheSportsDB API may not expose every live game's score. Trigger skips completed games rather than alerting on stale results.
- Groq parsing and geocoding/team/coin lookup require network access when creating a trigger. The API limits parse requests to ten per user per minute and caps prompt length at 500 characters.

See [`SPEC.md`](SPEC.md) for the data contract and evaluation rules.

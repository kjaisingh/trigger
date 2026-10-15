# Trigger

[![CI](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml/badge.svg)](https://github.com/kjaisingh/trigger/actions/workflows/ci.yml)

Trigger turns a plain-English request into an editable alert. A scheduled check evaluates saved conditions every 15 minutes and records matches; browser push notifications require permission on each device. Alerts are not real time.

## Features

- Create, edit, pause, resume, and delete alerts from natural-language requests.
- Monitor supported data:
  - Weather via Open-Meteo: temperature, precipitation, wind, and snowfall.
  - Live sports via TheSportsDB: team score, opponent score, and score difference.
  - Crypto via CoinGecko: USD coin price.
- Choose one-time or recurring alerts, with level or false-to-true edge conditions.
- Review check status and alert history; save unsupported requests without monitoring them.
- Install the web app and enable push notifications per device.

## Architecture

- React and Vite provide the client; an Express API serves it on Render and verifies Supabase Auth tokens.
- Supabase Postgres stores alerts, history, and push subscriptions with row level security.
- Groq parses a request when it is created. Domain adapters compare values deterministically during checks.
- Supabase `pg_cron` and `pg_net` call an Edge Function every 15 minutes, independently of Render.
- Web Push uses VAPID keys to deliver device notifications.

## Setup

1. Install Node.js 22.12 or newer and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) and then [`supabase/keepalive.sql`](supabase/keepalive.sql) in its SQL Editor.
2. Install dependencies, then copy [`.env.example`](.env.example) to `.env`.

   ```bash
   npm ci
   ```

   ```bash
   cp .env.example .env
   ```

3. Generate VAPID keys. Fill in the Supabase, Groq, and VAPID values in `.env`; use the same public key for `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY`.

   ```bash
   npx web-push generate-vapid-keys
   ```

4. Start the client at <http://localhost:5173>. Local development does not start the scheduled evaluator.

   ```bash
   npm run dev
   ```

5. Create a [Render Blueprint](render.yaml) and set its Supabase, Groq, and VAPID environment values. Add the public origin to Supabase Auth's allowed redirect URLs.
6. Set the Edge Function's `VAPID_SUBJECT`, VAPID keys, and a new `CRON_SHARED_SECRET` in Supabase. Deploy the evaluator:

   ```bash
   supabase functions deploy evaluate-triggers --project-ref <project-ref>
   ```

7. Fill in and run the commented `cron.schedule` block in [`supabase/schema.sql`](supabase/schema.sql) using the project ref, service role key, and same cron secret. Keep these values out of Git. See [the behavior contract](SPEC.md) for evaluation rules.

## Supabase keepalive

Run [`supabase/keepalive.sql`](supabase/keepalive.sql) after the application schema. It creates a fixed, non-sensitive row with an anonymous read policy limited to that row.

The enabled [cron-job.org](https://console.cron-job.org/jobs) job `Trigger Supabase keepalive (lzjdswxkdlmmajmsurwt)` sends a GET request to `https://lzjdswxkdlmmajmsurwt.supabase.co/rest/v1/keepalive?select=id&limit=1` every six hours in `America/New_York` (`10 */6 * * *`). Set its `apikey` header to this project's Supabase publishable key. Save responses and enable failure, recovery, and disabled-job notifications. A test run should return HTTP 200 with `[{"id":1}]`.

This request reaches Supabase directly, even when the Render service is asleep. Monitor failed runs; free-tier activity does not guarantee uninterrupted availability.

## Dependency maintenance

Dependabot version-update PRs are disabled in [`.github/dependabot.yml`](.github/dependabot.yml) so the repository keeps only `main`. CI runs `npm audit`, formatting, lint, tests, and the build on pushes and weekly (Monday 09:17 UTC); it can also be started manually. Review dependency releases manually and update related packages together, especially React with React DOM and ESLint with its plugins. Increase `open-pull-requests-limit` to resume automated update PRs. GitHub may disable scheduled workflows after prolonged inactivity in a public repository, so do not treat the weekly audit as a guaranteed security monitor.

## Feature backlog

- Add email and SMS delivery with per-channel preferences.
- Support more domains, such as stocks, air quality, and RSS feeds.
- Let users choose check intervals and quiet hours.
- Add provider failover, caching, and delivery retries with visibility into failures.
- Add automated database backups and alerts for stalled scheduled checks.

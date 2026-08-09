# Trigger — Product Spec

Natural-language alerting app. User types condition in plain English, app parses it, polls real data, alerts when true.

Budget: $0/month. Public-facing portfolio demo. Build fast, LLM-assisted.

## 1. Stack

- Frontend: React + Vite
- Backend: Node + Express, single service, serves built frontend + on-demand CRUD API only (no longer runs the scheduler — see §2). Render free tier, fine for it to sleep between visits.
- DB: Supabase Postgres (free tier)
- Auth: Supabase Auth (email/password)
- Hosting: Render free web service, on-demand only
- LLM parsing: single app-default free key (**Groq**), no BYOK yet — BYOK deferred to the future generic-web-crawling feature (§10), not needed for the currently supported domains
- Weather: Open-Meteo (no key, free geocoding+forecast)
- Sports: TheSportsDB (free test key, covers soccer/basketball/NFL/NHL/MLB/motorsport etc under one API — generalizes past football)
- Crypto/price: CoinGecko public API (no key, free) — cheap extra domain, see §6
- Web push: `web-push` npm + self-generated VAPID keypair

## 2. Architecture — scheduler lives in Supabase, not Render

You don't want to depend on the Render service staying up for polling. Answer: **yes, fully possible** — move the whole evaluation loop into Supabase itself:

- **pg_cron** (free Postgres extension, already available on the free plan) schedules a job on an interval (e.g. every 15-30 min — deliberately coarse per your ask, easy to retune via one cron string).
- The job calls **pg_net**'s `net.http_post` to invoke a **Supabase Edge Function** (Deno runtime, 500k free invocations/month, 150s timeout per call — plenty for a fetch-and-compare pass).
- The Edge Function does the actual work: load active triggers, fetch each domain's API, evaluate condition, write `trigger_events`, send web push.

Result: Render can be fully asleep 99% of the time — it only wakes for someone actually loading the site or hitting the CRUD API to manage triggers. The thing that needs to stay "alive" (Supabase) is serverless by design, so there's no instance to keep warm. This also fixes the earlier GitHub Actions dependency — one less moving part.

```sql
select cron.schedule(
  'evaluate-triggers',
  '*/15 * * * *',   -- retune freely; 500k free invocations/mo gives huge headroom even at 5 min
  $$ select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/evaluate-triggers',
       headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
     ) $$
);
```

Coarser polling than originally planned means alerts land within the poll window, not instantly — stated plainly in UI copy (§8), not hidden.

## 3. Data model

```sql
-- users: auth.users (Supabase Auth)

triggers
  id uuid pk
  user_id uuid fk -> auth.users
  raw_prompt text
  domain text              -- 'weather' | 'sports' | 'crypto' | 'unsupported'
  subject jsonb             -- domain-specific identity: {location, lat, lon} / {team_a, team_b, sport} / {coin_id} / {from_contains}
  condition jsonb           -- generalized DSL, see §5: { metric, operator, threshold, edge_trigger }
  channels text[]           -- ['push'] for now
  status text               -- 'active' | 'fired' | 'paused' | 'unsupported' | 'error'
  recurring boolean default false
  last_checked_at timestamptz
  last_state jsonb          -- last fetched raw value, needed for edge-triggered conditions ("stops raining")
  created_at timestamptz

trigger_events
  id uuid pk
  trigger_id uuid fk
  fired_at timestamptz
  payload jsonb
  channels_sent text[]
  error text

push_subscriptions
  id uuid pk
  user_id uuid fk
  endpoint text
  keys jsonb
  created_at timestamptz
```

RLS on all tables: `user_id = auth.uid()`.

## 4. Condition parsing — no fixed phrase list

The whole point: "temp > 32°F in Boston" and "let me know when it stops raining" should both work, without hardcoding either phrasing. One LLM call, two jobs:

**1. Domain routing.** Given the raw prompt, classify into `weather | sports | crypto | unsupported`. This is auto-routing, not a dropdown the user fills in first — they just type the sentence. The confirm screen (§8) shows the detected domain and lets them override it if the LLM guessed wrong, rather than forcing a manual pre-selection every time.

**2. Condition extraction into a generalized DSL**, same shape regardless of domain:
```json
{ "metric": "temperature_f", "operator": ">", "threshold": 32, "edge_trigger": false }
{ "metric": "precipitation_mm", "operator": "==", "threshold": 0, "edge_trigger": true }
```
`edge_trigger: true` means "fire on the transition" (was raining, now isn't) rather than "fire whenever this is currently true" (which would refire every poll). `metric` is validated server-side against an allow-list per domain (temperature_f, precipitation_mm, wind_mph for weather; score_diff, score_home, score_away for sports; price_usd for crypto) — if the LLM returns a metric outside that list, the answer is rejected and re-asked once, not silently coerced.

**Feasibility fallback.** If the LLM can't map the prompt to a supported domain + metric (e.g. "let me know when my flight is delayed", "tell me when this product restocks") it returns `domain: "unsupported"` with a plain-English reason. The trigger is *not* silently force-fit into the nearest domain — it's saved as `status: 'unsupported'` and the UI tells the user plainly this isn't monitorable yet, pointing at the generic-web-crawling backlog item (§10) as the future answer for open-ended conditions.

Evaluation itself (comparing fetched value against `{metric, operator, threshold}`) is deterministic code inside the Edge Function — the LLM is only called once, at creation time, not on every poll tick.

## 5. Supported domains

**weather** — Open-Meteo. Geocode `subject.location` once at creation (cache lat/lon on the trigger row), poll current conditions each tick, compare `metric` to `condition`.

**sports** — TheSportsDB. Look up events matching `subject.team_a`/`team_b` (any sport it covers — soccer, basketball, NFL, NHL, MLB, F1, etc. — not soccer-only), compare live score fields to `condition`. Free test key has modest rate limits; fine at a 15-30 min poll interval.

**crypto** — CoinGecko. `subject.coin_id` (e.g. `bitcoin`), compare `price_usd` to `condition`. Genuinely trivial to add given the same DSL — good first domain to bolt on after weather/sports are working, since there's no new architecture involved, just a new fetch adapter.

## 6. Notification channels

**MVP: Web Push only.** VAPID keypair, self-hosted, zero vendor, zero cost. Covers desktop Chrome/Firefox/Edge and Android fully; iOS only if the user's added the site to their home screen as a PWA (2024+ Safari behavior) — worth one line of UI copy so it doesn't read as broken.

**Backlog:** Email (nodemailer + Gmail SMTP app password) — cut from MVP per your call, not worth the setup cost right now given push covers the demo. SMS — no genuinely free option exists currently (Twilio's free tier is gone, it's pay-per-message); only revisit if a user wants to BYO a Twilio key later, not worth building speculatively.

## 7. Core features & user flows

1. **Sign up / sign in** — Supabase Auth, email/password.
2. **Create a trigger** — type a plain-English sentence → `/api/triggers/parse` → LLM returns `{domain, subject, condition, suggested_channels}` → shown back as an editable, human-readable confirmation ("Watching: temperature in Boston, MA. Fires when: above 32°F.") → user can tweak domain/fields or just confirm → saved `active`.
3. **Grant push permission** — prompted once, subscription stored.
4. **Background evaluation** — invisible to the user; Supabase-side loop (§2) does the work.
5. **Get notified** — push fires, trigger marked `fired` (or stays `active` if `recurring`), event logged.
6. **Review history** — see past fires with the data that satisfied them, on the trigger's own page.
7. **Manage triggers** — pause/resume/delete; unsupported ones shown distinctly with the plain-English reason.

## 8. Pages / screens

- **Landing (public, logged-out)** — what the app does, example prompts, sign-up CTA. This is the one shown to people evaluating the portfolio piece who never make an account, so it should stand alone.
- **Sign in / sign up**
- **Dashboard** — list of triggers, status badges (active/fired/paused/unsupported/error), create button
- **Create trigger** — NL input box → confirmation/edit card (domain override dropdown, condition fields, channel checkboxes)
- **Trigger detail** — the parsed condition, last-checked time, fire history (`trigger_events`)
- **Settings** — push subscription management

## 9. Known limitations (state plainly, don't hide)

- Poll interval is coarse (15-30 min default) by design — not real-time. UI should say this rather than imply instant alerts.
- Web push doesn't reach iOS Safari unless added to home screen as a PWA.
- Free LLM tier (Groq) can change quota with no notice — parse endpoint should fail to a clear "try again shortly" rather than hang.
- TheSportsDB's free test key has rate limits tighter than a paid key — fine at the chosen poll interval, would need attention if interval were tightened later.
- CoinGecko's free API rate-limits by IP, and Render's free-tier shared outbound IP can trip it in practice (observed 429s in production testing) — a crypto trigger's checks will intermittently fail under this, surfaced via the `last_state.error` field and the "⚠ check failing" UI badge rather than failing silently; it self-clears once a poll succeeds.
- No RLS bypass anywhere except the Edge Function's service-role usage, same pattern as hivemind's backend already uses.

## 10. Stretch / backlog

- **Generic web-crawling condition** — for prompts that don't fit weather/sports/crypto (e.g. "tell me when this product restocks", "when my flight status changes"). This is where **BYOK** (OpenAI/Anthropic/Google/Groq/OpenRouter, one normalized interface) actually earns its place — a crawl-and-judge loop calling an LLM on every poll tick is exactly the kind of usage that would blow past a shared app-default free-tier key, so it's gated behind the user's own key rather than the app's.
- **Gmail domain** (new message from a given sender) — dropped from MVP scope to avoid the Google OAuth consent-screen setup and a token-encryption subsystem for a single domain; revisit if there's real demand.
- Email notification channel (nodemailer)
- SMS via user-supplied Twilio key (BYOK-style, off by default)
- Manual domain override made a first-class dropdown at creation time (right now it's an edit-after-the-fact affordance on the confirm screen)
- ESPN's unofficial public scoreboard API as a broader/livelier sports source — wider live-score coverage than TheSportsDB in practice, but undocumented and can break without notice, so it's a swap-in candidate rather than the initial choice

## 11. Decisions (resolved)

- Auth: **Supabase Auth**, email/password only.
- App-default LLM: **Groq**, single key, no BYOK until the generic web-crawling feature.
- Gmail domain: **dropped from MVP** — simplifies auth to plain email/password and removes the token-encryption subsystem; backlogged (§10).
- Scheduler: **Supabase pg_cron + pg_net → Edge Function**, not Render/GitHub Actions — Render fully decoupled from polling.
- Notification channels: **web push only** for MVP; email and SMS backlogged.
- Sports: **TheSportsDB**, multi-sport, not soccer-only.
- New domain added: **crypto price** (CoinGecko), cheap to bolt on to the same DSL.

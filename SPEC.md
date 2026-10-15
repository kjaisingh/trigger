# Trigger: behavior and data contract

This describes the current app. Setup and deployment steps are in [`README.md`](README.md).

## Trigger lifecycle

1. An authenticated user submits `raw_prompt` (1–500 characters) to `POST /api/triggers/parse`. Groq returns a supported domain with subject and condition, or `unsupported` with a reason. The user may edit the preview. Parsing is limited to ten requests per user per minute.
2. `POST /api/triggers` validates the selected domain, its subject, a finite numeric threshold, comparison operator, edge flag, `recurring` boolean, and the only supported channel (`push`). It resolves a weather location, sports team, or CoinGecko coin once and stores the resolved identity. An unsupported trigger is saved with status `unsupported` and never evaluated.
3. A Supabase cron job calls `evaluate-triggers` every 15 minutes. The function reads active triggers in pages, evaluates up to eight at a time, fetches the corresponding data, and records `last_checked_at` and `last_state`. Provider failures are stored as a check error; the next successful check clears it. The UI flags an active trigger if its first or latest check is more than 30 minutes old.
4. When a condition fires, the function claims the observed state before sending push. This prevents overlapping cron invocations from sending the same observation twice. A one-time trigger changes to `fired`; a recurring trigger stays `active`. A history event records the condition and which channel actually delivered. Dead push subscriptions are removed.
5. Users may pause, resume, or delete their own triggers. A paused trigger is not evaluated. The detail API shows the latest 100 history events; older events remain stored.

## Stored fields

`triggers` contains `id`, `user_id`, `raw_prompt`, `domain`, `subject`, `condition`, `channels`, `status`, `recurring`, `unsupported_reason`, `last_checked_at`, `last_state`, and `created_at`. `trigger_events` contains `trigger_id`, `fired_at`, `payload`, `channels_sent`, and optional `error`. `push_subscriptions` contains a globally unique `endpoint`, `user_id`, encryption `keys`, and `created_at`. See [`supabase/schema.sql`](supabase/schema.sql) for SQL types and RLS policies. Client roles have SELECT-only grants and policies; the API and evaluator use the service role for writes. The existing hosted project received [`20261015_read_only_clients.sql`](supabase/migrations/20261015_read_only_clients.sql).

| Domain    | Parsed subject        | Resolved subject                                        | Allowed metrics                                                |
| --------- | --------------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| `weather` | `{ location }`        | `{ location, admin1, country, lat, lon }`               | `temperature_f`, `precipitation_mm`, `wind_mph`, `snowfall_cm` |
| `sports`  | `{ team, opponent? }` | `{ teamId, teamName, sport, opponentId, opponentName }` | `score_diff`, `team_score`, `opponent_score`                   |
| `crypto`  | `{ coin_id }`         | `{ coinId }`                                            | `price_usd`                                                    |

A condition has `{ metric, operator, threshold, edge_trigger }`. Operators are `>`, `>=`, `<`, `<=`, `==`, and `!=`. `threshold` is a finite number; `edge_trigger` is a boolean. The UI and API share the metric/operator list in [`shared/domains.js`](shared/domains.js).

## Firing rules

- A level condition is true whenever its latest numeric value satisfies the comparison. A recurring level trigger may fire on every scheduled check while true.
- An edge condition must have a prior observation of the **same subject event** that was false. Its first observation establishes a baseline, even if true. For sports, a different match ID establishes a new baseline.
- Missing or nonfinite values never fire. Sports evaluation requires an explicitly live status and valid scores, whether the event appears in upcoming or recent results. It skips future fixtures and completed matches. Provider coverage may be incomplete.
- A history event may show `channels_sent: []` and an error if the condition fired but no device received a push. A one-time trigger still becomes `fired` after its condition fires.

## Boundaries

The browser receives only the Supabase anon key and VAPID public key. The Express API verifies Supabase access tokens and scopes trigger and push operations to the user. The Edge Function uses the Supabase service role key and checks the cron secret. User input is bounded and validated at the API; upstream requests time out and retry transient failures. The public API returns generic server errors, while the server logs the underlying error.

The Render service does not run polling. `/api/health` checks process liveness, while `/api/ready` makes a bounded Supabase query and returns 503 if the database is unavailable. Supabase Edge Function and cron deployment are separate from a Render build. The app does not provide email, SMS, custom polling intervals, generic webpage monitoring, or guaranteed Free-tier database uptime.

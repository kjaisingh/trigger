-- Trigger schema. Run this once in the Supabase SQL editor for a fresh project.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_prompt text not null,
  domain text not null check (domain in ('weather', 'sports', 'crypto', 'unsupported')),
  subject jsonb not null default '{}'::jsonb,
  condition jsonb not null default '{}'::jsonb,
  channels text[] not null default array['push'],
  status text not null default 'active' check (status in ('active', 'fired', 'paused', 'unsupported', 'error')),
  recurring boolean not null default false,
  unsupported_reason text,
  last_checked_at timestamptz,
  last_state jsonb,
  created_at timestamptz not null default now()
);

create table if not exists trigger_events (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid not null references triggers(id) on delete cascade,
  fired_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  channels_sent text[] not null default array[]::text[],
  error text
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists triggers_user_id_idx on triggers(user_id);
create index if not exists triggers_status_idx on triggers(status);
create index if not exists trigger_events_trigger_id_idx on trigger_events(trigger_id);
create index if not exists push_subscriptions_user_id_idx on push_subscriptions(user_id);

alter table triggers enable row level security;
alter table trigger_events enable row level security;
alter table push_subscriptions enable row level security;

create policy "triggers_owner_all" on triggers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trigger_events_owner_select" on trigger_events
  for select using (exists (
    select 1 from triggers t where t.id = trigger_events.trigger_id and t.user_id = auth.uid()
  ));

create policy "push_subscriptions_owner_all" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- After deploying the evaluate-triggers Edge Function, schedule it from Postgres itself.
-- Replace <project-ref>, <service-role-key> and <cron-shared-secret> before running.
-- select cron.schedule(
--   'evaluate-triggers',
--   '*/15 * * * *',
--   $$ select net.http_post(
--        url := 'https://<project-ref>.functions.supabase.co/evaluate-triggers',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer <service-role-key>',
--          'x-cron-secret', '<cron-shared-secret>'
--        )
--      ) $$
-- );

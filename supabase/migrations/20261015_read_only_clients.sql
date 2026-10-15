-- Apply once to existing Trigger projects. Safe to rerun.
revoke all privileges on public.triggers, public.trigger_events, public.push_subscriptions from anon, authenticated;
grant select on public.triggers, public.trigger_events, public.push_subscriptions to authenticated;
grant select on public.triggers to anon;

drop policy if exists "triggers_owner_all" on public.triggers;
drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
drop policy if exists "triggers_owner_select" on public.triggers;
drop policy if exists "push_subscriptions_owner_select" on public.push_subscriptions;
create policy "triggers_owner_select" on public.triggers
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_owner_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create index if not exists triggers_status_id_idx on public.triggers(status, id);
create index if not exists triggers_user_created_idx on public.triggers(user_id, created_at desc);
create index if not exists trigger_events_trigger_fired_idx on public.trigger_events(trigger_id, fired_at desc);
drop index if exists public.triggers_user_id_idx;
drop index if exists public.triggers_status_idx;
drop index if exists public.trigger_events_trigger_id_idx;

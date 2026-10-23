-- Apply before deploying the evaluator. Existing tables and the old evaluator remain compatible.
create or replace function public.record_trigger_check(
  p_trigger_id uuid,
  p_last_checked_at timestamptz,
  p_state jsonb,
  p_payload jsonb default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  claimed_id uuid;
  event_id uuid;
begin
  update public.triggers
  set last_checked_at = greatest(clock_timestamp(), p_last_checked_at + interval '1 microsecond'),
      last_state = p_state,
      status = case when p_payload is not null and not recurring then 'fired' else 'active' end
  where id = p_trigger_id and status = 'active'
    and last_checked_at is not distinct from p_last_checked_at
  returning id into claimed_id;

  if claimed_id is not null and p_payload is not null then
    insert into public.trigger_events (trigger_id, payload, error)
    values (claimed_id, p_payload, 'Delivery pending or interrupted')
    returning id into event_id;
  end if;
  return event_id;
end;
$$;

revoke all on function public.record_trigger_check(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_trigger_check(uuid, timestamptz, jsonb, jsonb) to service_role;

create table if not exists public.evaluator_status (
  id boolean primary key default true check (id),
  completed_at timestamptz not null,
  evaluated integer not null,
  failed integer not null,
  version text not null
);
alter table public.evaluator_status enable row level security;
revoke all on public.evaluator_status from anon, authenticated;
grant all on public.evaluator_status to service_role;

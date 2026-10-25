-- Only request counts and opaque account IDs are retained; no conversation text.
create schema if not exists einstein_private;
revoke all on schema einstein_private from public, anon, authenticated;
grant usage on schema einstein_private to service_role;

create table if not exists einstein_private.request_windows (
  scope text not null check (scope in ('user-minute', 'user-day', 'global-day')),
  subject_id uuid not null,
  window_start timestamptz not null,
  requests integer not null check (requests >= 0),
  primary key (scope, subject_id, window_start)
);
alter table einstein_private.request_windows enable row level security;
revoke all on table einstein_private.request_windows from public, anon, authenticated;
grant select, insert, update, delete on table einstein_private.request_windows to service_role;

create or replace function public.einstein_reserve_request(
  p_user_id uuid,
  p_user_daily_limit integer default 20,
  p_user_minute_limit integer default 5,
  p_global_daily_limit integer default 200
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_minute timestamptz := pg_catalog.date_trunc('minute', v_now);
  v_day timestamptz := pg_catalog.date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_global_id uuid := '00000000-0000-0000-0000-000000000000';
  v_minute_count integer;
  v_user_count integer;
  v_global_count integer;
begin
  if p_user_id is null or p_user_id = v_global_id
    or p_user_daily_limit not between 1 and 200
    or p_user_minute_limit not between 1 and 30
    or p_global_daily_limit not between 1 and 10000
    or p_user_daily_limit is null or p_user_minute_limit is null or p_global_daily_limit is null then
    raise exception 'Invalid quota request' using errcode = '22023';
  end if;

  -- One short database transaction serializes all three counters. Limits remain
  -- effective across concurrent requests, regions and Edge Function restarts.
  perform pg_catalog.pg_advisory_xact_lock(671220240001::bigint);
  delete from einstein_private.request_windows where window_start < v_day - interval '2 days';
  select coalesce(max(requests) filter (where scope = 'user-minute' and subject_id = p_user_id and window_start = v_minute), 0),
    coalesce(max(requests) filter (where scope = 'user-day' and subject_id = p_user_id and window_start = v_day), 0),
    coalesce(max(requests) filter (where scope = 'global-day' and subject_id = v_global_id and window_start = v_day), 0)
  into v_minute_count, v_user_count, v_global_count
  from einstein_private.request_windows
  where (subject_id = p_user_id or subject_id = v_global_id) and window_start >= v_day;

  if v_minute_count >= p_user_minute_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'retry_after_seconds', greatest(1, ceil(extract(epoch from v_minute + interval '1 minute' - v_now))::integer));
  end if;
  if v_user_count >= p_user_daily_limit or v_global_count >= p_global_daily_limit then
    return pg_catalog.jsonb_build_object('allowed', false, 'retry_after_seconds', greatest(1, ceil(extract(epoch from v_day + interval '1 day' - v_now))::integer));
  end if;

  insert into einstein_private.request_windows(scope, subject_id, window_start, requests)
  values ('user-minute', p_user_id, v_minute, 1), ('user-day', p_user_id, v_day, 1), ('global-day', v_global_id, v_day, 1)
  on conflict (scope, subject_id, window_start)
  do update set requests = einstein_private.request_windows.requests + 1;
  return pg_catalog.jsonb_build_object('allowed', true);
end;
$$;

-- The edge function supplies the remotely verified user ID with its server key.
-- Clients cannot spend another user's allowance or inspect usage counters.
revoke all on function public.einstein_reserve_request(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.einstein_reserve_request(uuid, integer, integer, integer) to service_role;
comment on table einstein_private.request_windows is 'Ephemeral Einstein request counters; no prompts, messages, emails or model answers.';

-- Deletions span Postgres and Storage. Hide an in-progress deletion and retry
-- the final row removal if Storage succeeds during a temporary DB outage.
alter table public.spaces
  add column if not exists deleting_at timestamptz,
  add column if not exists deletion_files_removed boolean not null default false;

-- Serialize each function's rate-limit check and usage insert in one database
-- transaction so concurrent requests cannot all pass the same stale count.
create or replace function public.check_and_log_usage(
  p_fn text,
  p_user_id uuid,
  p_ip_hash text,
  p_per_hour integer,
  p_per_day integer,
  p_global_per_day integer default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  global_day_count integer;
  caller_hour_count integer;
  caller_day_count integer;
begin
  if p_fn is null or p_per_hour < 1 or p_per_day < 1 then
    raise exception 'invalid rate-limit arguments';
  end if;
  if p_user_id is null and coalesce(p_ip_hash, '') = '' then
    raise exception 'caller identity is required';
  end if;

  -- One lock per endpoint also makes the global circuit breaker exact.
  perform pg_advisory_xact_lock(hashtextextended('tidymap-rate:' || p_fn, 0));

  if p_global_per_day is not null then
    select count(*) into global_day_count
    from public.usage_events
    where fn = p_fn and created_at >= now() - interval '1 day';
    if global_day_count >= p_global_per_day then return 3600; end if;
  end if;

  select
    count(*) filter (where created_at >= now() - interval '1 hour'),
    count(*)
  into caller_hour_count, caller_day_count
  from public.usage_events
  where fn = p_fn
    and created_at >= now() - interval '1 day'
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_user_id is null and user_id is null and ip_hash = p_ip_hash)
    );

  if caller_day_count >= p_per_day then return 21600; end if;
  if caller_hour_count >= p_per_hour then return 1800; end if;

  insert into public.usage_events (user_id, ip_hash, fn)
  values (p_user_id, case when p_user_id is null then p_ip_hash else null end, p_fn);
  return 0;
end;
$$;

revoke all on function public.check_and_log_usage(text, uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_and_log_usage(text, uuid, text, integer, integer, integer)
  to service_role;

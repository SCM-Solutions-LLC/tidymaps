-- Neither usage_events nor telemetry_events had a purge, so both grow
-- forever. usage_events exists purely to answer check_and_log_usage's "how
-- many calls in the last hour/day" question; nothing anywhere reads a row
-- older than a day. telemetry_events feeds the trend reports in
-- supabase/queries/telemetry.sql, which look across weeks rather than a
-- fixed window, so it gets a longer runway before it is pure liability with
-- no remaining use.
--
-- Installed in `extensions`, not `public`, matching the schema hygiene the
-- Supabase advisors already flag for pg_net (see 0009's notes) rather than
-- repeating the same finding for a second extension.
create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_old_events() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.usage_events where created_at < now() - interval '30 days';
  delete from public.telemetry_events where created_at < now() - interval '180 days';
end;
$$;

revoke all on function public.purge_old_events() from public, anon, authenticated;
grant execute on function public.purge_old_events() to service_role;

select cron.schedule('purge-old-events', '30 3 * * *', $$select public.purge_old_events();$$);

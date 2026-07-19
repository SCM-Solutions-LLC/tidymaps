-- First-party anonymous usage events. Written ONLY by the track-events edge
-- function (service role) after allowlist sanitization; RLS is enabled with
-- no policies, so neither the anon key nor signed-in users can read or write
-- rows directly. anon_id is a client-generated random UUID with no link to
-- identity; user_id is set only for signed-in sessions so funnel and account
-- behavior can be joined later. No IPs are stored.
create table public.telemetry_events (
  id bigint generated always as identity primary key,
  anon_id uuid,
  user_id uuid,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index telemetry_events_name_idx on public.telemetry_events (name, created_at desc);
create index telemetry_events_anon_idx on public.telemetry_events (anon_id, created_at desc);
alter table public.telemetry_events enable row level security;

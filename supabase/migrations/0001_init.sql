-- TidyMap core schema: profiles, spaces, media, usage ledger
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  household jsonb,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My space',
  space_type text,
  goal text,
  dims jsonb,
  household jsonb,
  prefs jsonb,
  plan jsonb,
  plan_meta jsonb,
  shopping jsonb,
  progress jsonb,
  arrangement jsonb,
  after_render_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spaces_user_idx on public.spaces (user_id, updated_at desc);
alter table public.spaces enable row level security;
create policy "own spaces all" on public.spaces for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger spaces_touch before update on public.spaces
  for each row execute function public.touch_updated_at();

create table public.space_media (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo','frame','after_render')),
  storage_path text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index space_media_space_idx on public.space_media (space_id, sort);
alter table public.space_media enable row level security;
create policy "own media all" on public.space_media for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rate-limit ledger. RLS enabled with NO policies: service-role access only.
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  ip_hash text,
  fn text not null,
  created_at timestamptz not null default now()
);
create index usage_events_rate_idx on public.usage_events (fn, created_at desc);
alter table public.usage_events enable row level security;

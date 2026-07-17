-- Founding Circle invite requests: anyone may submit, nobody may read from the client.
-- View them in the Supabase dashboard (Table Editor -> invite_requests).
create table public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index invite_requests_email_key on public.invite_requests (lower(email));
alter table public.invite_requests enable row level security;
create policy "anyone can request an invite" on public.invite_requests for insert
  to anon, authenticated with check (true);

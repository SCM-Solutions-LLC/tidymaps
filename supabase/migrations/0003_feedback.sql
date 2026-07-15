-- Feedback: anyone may submit, nobody may read from the client
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  useful text,
  vs text,
  comments text,
  next_space text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "anyone can submit" on public.feedback for insert
  to anon, authenticated with check (true);

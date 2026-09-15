-- Supabase advisor findings. Two of the four this batch set out to fix turned
-- out to already be closed, on purpose, in 0009 — see its own comment for the
-- measurements behind each: `handle_new_user` executable by anon/authenticated
-- is a false positive (verified by calling it directly; it fails closed
-- because its return type is `trigger`), and pg_net living in `public` is a
-- Supabase default, not a choice made here, and moving an installed extension
-- is invasive for no gain. Neither is touched again here.
--
-- The two left: `auth_rls_initplan` and `unindexed_foreign_keys`.
--
-- `auth_rls_initplan`: a bare auth.uid() in a policy is re-evaluated once per
-- row, because the planner cannot prove on its own that it is stable across
-- rows. Wrapping it in a scalar subselect gives the planner an InitPlan it
-- can evaluate once per query and reuse — same result, cheaper as the table
-- grows. Five policies had this: three on profiles, one each on spaces and
-- space_media. storage.objects' three policies (0002) use the same pattern
-- but are outside this scan's five.
alter policy "own profile select" on public.profiles
  using (id = (select auth.uid()));
alter policy "own profile insert" on public.profiles
  with check (id = (select auth.uid()));
alter policy "own profile update" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "own spaces all" on public.spaces
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "own media all" on public.space_media
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- `unindexed_foreign_keys`: feedback.user_id and invite_requests.user_id have
-- no index at all, and space_media.user_id has none despite space_id already
-- being indexed. A delete on auth.users, or any lookup by user_id, scans the
-- full table to find referencing rows without one.
create index feedback_user_idx on public.feedback (user_id);
create index invite_requests_user_idx on public.invite_requests (user_id);
create index space_media_user_idx on public.space_media (user_id);

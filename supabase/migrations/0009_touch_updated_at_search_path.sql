-- `public.touch_updated_at` was created in 0001 without a pinned search_path,
-- which the Supabase database linter flags as `function_search_path_mutable`.
--
-- Scope of the actual risk, stated honestly: this one is SECURITY INVOKER, so
-- it already runs as the caller and resolving a name through a hostile
-- search_path buys an attacker nothing they did not already have. The reason
-- to fix it anyway is that the advisor list is a standing signal, and a WARN
-- nobody intends to act on trains everyone to skim past the next one. That is
-- the same failure mode as the expired API key: a channel that is always a
-- little bit red stops being read.
--
-- `set search_path = ''` rather than a schema list, so every object this
-- function touches has to be schema-qualified. It touches none: the body only
-- assigns to a column of the row already handed to it, and now() is in
-- pg_catalog, which is always searched regardless.
--
-- Every other advisor notice on this project is a decision, not a bug, and is
-- deliberately left alone:
--   * `rls_enabled_no_policy` on feedback, invite_requests, telemetry_events
--     and usage_events is the intended design. RLS on with zero policies means
--     the browser's anon key can read and write nothing at all; every legitimate
--     write goes through an edge function holding the service role. 0008 removed
--     the last direct-write policies on purpose. Adding a policy to silence the
--     linter would reopen exactly what 0008 closed.
--   * `anon_security_definer_function_executable` on public.handle_new_user is
--     a false positive twice over, and this was measured rather than assumed:
--     it already carries `set search_path = ''`, and its return type is
--     `trigger`, so a direct call fails closed. Calling it on this database
--     returns `sqlstate=0A000 :: trigger functions can only be called as
--     triggers`, and public.profiles was unchanged afterwards.
--   * `extension_in_public` for pg_net: a Supabase default rather than a choice
--     made here, and relocating an installed extension is invasive for no gain.
--   * Auth leaked-password protection off: sign-in is magic-code only, so there
--     is no password to check against HaveIBeenPwned.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

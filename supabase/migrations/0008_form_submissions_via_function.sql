-- feedback and invite_requests were the only two tables the browser wrote
-- directly, under `insert to anon, authenticated with check (true)`. Three
-- problems came with that:
--
--   * The rate limiter lives in the edge functions, not in RLS, so a direct
--     PostgREST insert had no ceiling at all. Anyone holding the public anon
--     key (it ships in js/config.js by design) could fill either table.
--   * user_id came from the request body, so a caller could attribute a
--     submission to another user's id.
--   * invite_requests has a unique index on lower(email), so the difference
--     between a duplicate-key error and a success told the caller whether an
--     address had already requested an invite.
--
-- Both now go through the submit-form edge function, which applies the same
-- check_and_log_usage ceilings as every other function, sets user_id from the
-- verified caller, and reports a duplicate invite identically to a fresh one.
-- The function uses the service role, which bypasses RLS, so dropping these
-- policies leaves it working and closes the direct path.
drop policy if exists "anyone can submit" on public.feedback;
drop policy if exists "anyone can request an invite" on public.invite_requests;

-- Both tables keep RLS enabled with no policies at all, matching usage_events
-- and telemetry_events: service-role writes only, and unreadable from the
-- client. View them in the dashboard.

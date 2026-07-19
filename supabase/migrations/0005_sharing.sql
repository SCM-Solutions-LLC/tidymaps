-- Read-only plan sharing. A space with a non-null share_id can be fetched by
-- anyone holding the link, via the get-shared-space edge function ONLY: the
-- function uses the service role and returns a sanitized subset of the row
-- (never household, progress, shopping, or media). RLS is unchanged — the
-- anon key still cannot read other users' rows directly. share_id is a v4
-- UUID (122 random bits), so links are unguessable; setting it to null
-- revokes the link instantly.
alter table public.spaces add column share_id uuid unique;
create index spaces_share_idx on public.spaces (share_id) where share_id is not null;

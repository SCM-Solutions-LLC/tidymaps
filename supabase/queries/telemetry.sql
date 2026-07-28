-- TidyMap telemetry report
-- ============================================================================
-- Every query here reads public.telemetry_events, which has RLS on and no
-- policies: run these as the service role (Supabase SQL editor / MCP), never
-- from the client.
--
-- Event contract lives in supabase/functions/_shared/telemetryEvents.js and is
-- enforced both client- and server-side. Shape:
--   name    text   one of the 8 allowlisted names
--   props   jsonb  flat primitives only
--   anon_id uuid   random per browser, linked to nothing
--
-- Read them in order. Query 0 tells you whether the numbers below mean
-- anything yet; nothing here is trustworthy while the sample is a handful of
-- sessions, most of them the team's own.
-- ============================================================================


-- 0. DATA HEALTH -------------------------------------------------------------
-- Is telemetry even arriving? A gap here is a bug, not a quiet week: the
-- client disables itself under Do Not Track, Global Privacy Control, and
-- navigator.webdriver, so a browser with GPC on (Brave, DDG, some Firefox
-- setups) contributes real usage and zero events. Cross-check against
-- public.usage_events, which the edge functions write server-side and no
-- browser setting can suppress.
select
  date_trunc('day', created_at)::date as day,
  count(*)                            as events,
  count(distinct anon_id)             as browsers,
  count(distinct name)                as event_kinds
from public.telemetry_events
group by 1
order by 1 desc;

-- Client-visible activity (above) vs server-side truth (below). If the second
-- has days the first doesn't, telemetry is being suppressed or is broken.
select
  date_trunc('day', created_at)::date as day,
  fn,
  count(*) as calls
from public.usage_events
group by 1, 2
order by 1 desc, 3 desc;


-- 1. THE QUESTION THE WHOLE THING EXISTS TO ANSWER ---------------------------
-- Does working the plan predict willingness to pay? "Worked the plan" is
-- >= 3 steps checked; the verdict is the feedback form's "useful" answer,
-- whose top option is literally "I would pay for this".
--
-- Read the would_pay_pct column across the two worked_the_plan rows. If
-- checking steps is what converts, the true row is dramatically higher, and
-- the product bet (a detailed, step-by-step plan) is the right one.
with depth as (
  select anon_id, max((props->>'checkedCount')::int) as steps_checked
  from public.telemetry_events
  where name = 'step_checked'
  group by anon_id
),
verdict as (
  select distinct on (anon_id)
    anon_id,
    props->>'useful' as useful
  from public.telemetry_events
  where name = 'feedback_submitted'
  order by anon_id, created_at desc
)
select
  coalesce(d.steps_checked, 0) >= 3                                   as worked_the_plan,
  count(*)                                                            as people,
  count(*) filter (where v.useful = 'I would pay for this')           as would_pay,
  round(100.0 * count(*) filter (where v.useful = 'I would pay for this')
        / nullif(count(*), 0), 1)                                     as would_pay_pct
from verdict v
left join depth d using (anon_id)
group by 1
order by 1;

-- The same answer without collapsing the scale, for when there are enough
-- responses to see a gradient rather than a threshold.
with depth as (
  select anon_id, max((props->>'checkedCount')::int) as steps_checked
  from public.telemetry_events
  where name = 'step_checked'
  group by anon_id
),
verdict as (
  select distinct on (anon_id) anon_id, props->>'useful' as useful
  from public.telemetry_events
  where name = 'feedback_submitted'
  order by anon_id, created_at desc
)
select
  coalesce(d.steps_checked, 0) as steps_checked,
  v.useful,
  count(*) as people
from verdict v
left join depth d using (anon_id)
group by 1, 2
order by 1 desc, 3 desc;


-- 2. FUNNEL ------------------------------------------------------------------
-- Where people stop. The ordering mirrors js/router.js FLOW, so a screen
-- missing from these results was never reached by anyone.
with flow(step, screen) as (values
  (1,'landing'), (2,'space'), (3,'area'), (4,'setup'), (5,'measure'),
  (6,'capture'), (7,'household'), (8,'contents'), (9,'goals'), (10,'style'),
  (11,'effort'), (12,'shopping'), (13,'review'), (14,'loading'), (15,'results'),
  (16,'viewer3d'), (17,'customize'), (18,'save'), (19,'feedback'), (20,'done')
),
seen as (
  select props->>'screen' as screen, count(distinct anon_id) as people
  from public.telemetry_events
  where name = 'screen_viewed'
  group by 1
)
select
  f.step,
  f.screen,
  coalesce(s.people, 0) as people,
  coalesce(s.people, 0) - lag(coalesce(s.people, 0)) over (order by f.step) as change
from flow f
left join seen s using (screen)
order by f.step;


-- 3. PLAN QUALITY ------------------------------------------------------------
-- source is 'ai' when the edge function returned a validated plan, 'demo' when
-- there were no photos to analyze, and 'demo-fallback' when the AI path failed
-- and the deterministic engine covered for it. A rising demo-fallback share is
-- an outage in disguise: the user still gets a plan, so nobody complains.
select
  props->>'source' as source,
  props->>'space'  as space,
  count(*)         as plans,
  round(avg((props->>'steps')::int), 1) as avg_steps
from public.telemetry_events
where name = 'plan_created'
group by 1, 2
order by 3 desc;

select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where props->>'source' = 'ai')            as ai,
  count(*) filter (where props->>'source' = 'demo')          as demo,
  count(*) filter (where props->>'source' = 'demo-fallback') as fallback
from public.telemetry_events
where name = 'plan_created'
group by 1
order by 1 desc;


-- 4. ENGAGEMENT DEPTH --------------------------------------------------------
-- How far into a checklist people actually get. The 3-step mark is the line
-- query 1 splits on; this shows whether that line is in a sensible place.
select
  steps_checked,
  count(*) as people
from (
  select anon_id, max((props->>'checkedCount')::int) as steps_checked
  from public.telemetry_events
  where name = 'step_checked'
  group by anon_id
) d
group by 1
order by 1;

-- Completion rate against each plan's own length, which varies by effort level.
select
  (props->>'total')::int as plan_length,
  max((props->>'checkedCount')::int) as deepest_checked,
  count(distinct anon_id) as people
from public.telemetry_events
where name = 'step_checked'
group by 1
order by 1;


-- 5. THE REST OF THE PRODUCT -------------------------------------------------
-- Shopping intent: which retailers and product types get clicked at all.
select
  props->>'retailer'    as retailer,
  props->>'productType' as product_type,
  count(*)              as clicks,
  count(distinct anon_id) as people
from public.telemetry_events
where name = 'product_clicked'
group by 1, 2
order by 3 desc;

-- Photo preview reliability, straight from the client's point of view.
select
  props->>'ok' as succeeded,
  count(*)     as requests
from public.telemetry_events
where name = 'after_render_requested'
group by 1;

-- Sharing: links minted vs links actually opened. A link nobody opens is a
-- feature nobody wants; more views than links means each link travels.
select
  count(*) filter (where name = 'share_link_created') as links_created,
  count(*) filter (where name = 'shared_plan_viewed') as links_opened
from public.telemetry_events;

-- What people say, independent of what they did.
select
  props->>'useful'    as useful,
  props->>'vs'        as plan_vs_image,
  props->>'nextSpace' as next_space,
  count(*)            as responses
from public.telemetry_events
where name = 'feedback_submitted'
group by 1, 2, 3
order by 4 desc;

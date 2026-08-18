# Reading the telemetry

The queries live in [`supabase/queries/telemetry.sql`](../supabase/queries/telemetry.sql).
Run them as the service role — `telemetry_events` has RLS on with no policies,
so a browser can write events and nothing but the service role can read them.
The Supabase SQL editor works; so does the Supabase MCP `execute_sql` tool.

This page explains what to look at, in what order, and what the answers mean.

## The question

One thing justifies the whole telemetry table: **does working the plan predict
willingness to pay?**

- "Worked the plan" = `max(step_checked.props.checkedCount) >= 3` for an
  `anon_id`.
- "Would pay" = that same `anon_id` answering `"I would pay for this"` to the
  feedback form's `useful` question.

Query 1 puts those two side by side. If people who check steps say they'd pay
at a much higher rate than people who don't, the bet the product is making — a
detailed, ordered, timed checklist rather than a pretty after-image — is the
right one, and the next round of work goes into the checklist. If the rates are
the same, the checklist is decoration and the after-image is the product.

Everything else in the file is context for that answer.

## Read query 0 first

Query 0 is a freshness check, and it is not a formality. The client refuses to
emit anything when Do Not Track or Global Privacy Control is on, or when
`navigator.webdriver` is set. A tester using Brave, DuckDuckGo, or a
privacy-hardened Firefox generates real usage and **zero** telemetry rows.

So query 0 pairs `telemetry_events` against `usage_events`, which the edge
functions write server-side where no browser setting can suppress it. Days that
show up in `usage_events` and not in `telemetry_events` mean the events are
being suppressed or the client is broken — check the client before you conclude
anything about a quiet week.

This is not hypothetical: on 2026-07-28 the owner ran a full analysis and a
photo render (both visible in `usage_events`) while `telemetry_events` had
nothing newer than 2026-07-23. The client was verified working in a browser
harness the same day. Privacy settings, not a bug.

## Two corrections to apply before reading any of these numbers

Both are fixed in the code; both affect rows already in the table.

1. **`feedback_submitted` used to count submissions that never landed.** The
   event fired beside the write rather than after it, and the write's failure
   was swallowed, so any historical gap between this count and the `feedback`
   table is that bug rather than a join error. From the fix onward the event is
   sent only once the server has confirmed the row.
2. **`step_checked` used to count restores as fresh taps.** Reopening a plan,
   reloading a guest draft, following a `?space=` link and applying an Adjust
   option all restore the checklist through the same handler a tap uses, so
   every completed step was re-counted each time — inflating `checkedCount`,
   which is the depth signal this whole document turns on. A user with five
   steps done who reopened their plan twice produced fifteen events. Historical
   `checkedCount` values read HIGH, and the inflation grows with how often
   somebody came back — so the users who look most engaged are the ones whose
   numbers are least trustworthy.

Neither is fixable retroactively in the data. Read pre-fix rows as an upper
bound and prefer distinct `anon_id` over event counts.

## What the data says today (2026-07-28)

Sample: 4 browsers, 66 `screen_viewed`, 3 `plan_created`. Small, and mostly the
team. Nothing here is a finding; it is a baseline.

**The core question cannot be answered yet.** There are zero `step_checked` and
zero `feedback_submitted` events. Not a weak signal — no signal.

The funnel says why:

| screen | people |
|---|---|
| space → review (whole wizard) | 2 |
| loading | 2 |
| results | 2 |
| viewer3d | 2 |
| customize | **0** |
| save | **0** |
| feedback | **0** |

Everyone who starts the wizard finishes it and reads their plan. Nobody has
ever reached the screens past it. The report is the end of the road in
practice, and both of the things the product most needs to learn — do people
check steps off, would they pay — live past that point.

Two consequences, in priority order:

1. **The checklist has to be worked where people already are, on the report.**
   It is: `step_checked` fires from the results screen. Zero events there means
   nobody checked a box, not that they couldn't find one.
2. **Feedback is behind the save screen**, which nobody visits. Asking for the
   verdict somewhere on the report itself is the only way this number ever
   fills in.

All 3 plans were `source: 'demo'` — built without photos, so no AI call. AI
plan quality is therefore also unmeasured.

## Things the events cannot currently tell you

- **Whether a plan got saved.** There is no `space_saved` event. Saves are
  visible only as rows in `spaces`, which is not linkable to an `anon_id` (by
  design). Adding one means extending the allowlist in
  `supabase/functions/_shared/telemetryEvents.js` and redeploying
  `track-events` — the sanitizer runs on both sides and drops unknown names.
- **Anything about a single person over time.** `anon_id` is per browser and
  per localStorage; clearing storage makes a new one. Cohort and retention
  questions are out of reach with this table, on purpose.
- **Why someone stopped.** Screen views give the where, never the why.

## Adding an event

1. Add the name and its prop shape to `EVENT_NAMES` in
   `supabase/functions/_shared/telemetryEvents.js`.
2. Call `track('name', { ...flat primitives })` from the client.
3. Redeploy `track-events` — the server re-sanitizes every batch against the
   same allowlist, so an event the deployed function doesn't know about is
   dropped on arrival.
4. Add a query here, or the event is just storage.

Props must be flat primitives, strings are capped at 80 characters, and an
event serializes to at most 1 KB. Free text, photos, and household details are
unrepresentable rather than merely discouraged.

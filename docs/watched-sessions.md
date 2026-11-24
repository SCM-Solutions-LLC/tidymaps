# Watched sessions

Step one of open item 6 in `HANDOFF.md`: five friends, in person, each on
their own phone in their own pantry. The point is to find where people stall
or misread, before strangers hit the same wall unobserved. These five do not
count toward the stranger bar in item 6.

## Recruit

Text, not a call, so it is easy to say no:

> I built a thing that makes a step-by-step plan for a messy pantry from a
> few phone photos. Could I watch you try it on yours for 20 minutes? I won't
> help, that's the point. Coffee's on me.

Ask people whose pantry actually annoys them. A tidy pantry tests nothing.

## Setup, at their place

- **Their phone, their usual browser.** Brave, DuckDuckGo, or Firefox with
  Global Privacy Control send zero telemetry (`docs/telemetry.md`, query 0).
  If that is their browser, let them use it and write it in the notes table;
  their row will be missing from the SQL below.
- **Text them** `https://scmsolutions.org/tidymaps/?ref=watched`. Never open
  it on your own device: your visits are excluded by design.
- **Guest, not signed in.** That is the stranger path. Guests get 3 analyses
  an hour and 6 a day per network, so two sessions on one Wi-Fi in an hour
  is fine and a third may be refused.
- Pantry door open, lights on. Allow up to 80 seconds for the analysis.

## Your rules

1. Do not touch the phone and do not point.
2. If they ask what to do: "What would you do if I weren't here?"
3. Rescue only after 60 seconds stuck, and log that step as a failure.
4. Write what they say, word for word, not your reading of it.

## The task, read it as written

> Pretend you found this link and you want your pantry sorted out. Go as far
> as you would on your own, and think out loud. Stop whenever you'd stop in
> real life.

If they stop before the plan, that is the finding. Ask why, then let them
continue so the rest of the flow gets seen too.

## What to watch, step by step

| # | Screen | Watch for |
|---|---|---|
| 1 | Which space needs sorting out? | Finds pantry at once, or hunts |
| 2 | Which one looks like your pantry? | Hesitates between cards; picks one that does not match |
| 3 | How big is your pantry? | Fetches a tape, guesses, or skips; inches confusion |
| 4 | Add a few honest photos | How many, what angle, embarrassment, retakes |
| 5 | Who uses this space? | Questions it feels nosy to answer |
| 6 | What's kept in here? | Says items out loud that no option covers |
| 7 | What bugs you most about it? | Their spoken complaint vs the option they tap |
| 8 | How do you like things kept? | Reads the options or taps the first |
| 9 | How big a project is this? | Understands the effort scale |
| 10 | New containers, or work with what you have? | Budget worry |
| 11 | Here's what we heard | Corrects anything, or skims past |
| | Putting your plan together | Phone down, checks messages, or gives up |
| | Results | First words; scrolls to the steps; taps a product |
| | How useful is this plan? | What they say vs what they tap |

If the app says the photos show a different setup from the card picked, note
whether they switch or keep, and why.

## Four questions after

Ask about behavior, not opinion. Friends are kind about opinions.

1. "In one sentence, what did this give you?"
2. "Which step would you do first, and when?"
3. "What would you have done instead of using this?"
4. "Who would you send this to, if anyone?"

**Day 7:** text "Did you get to any of the steps?" Only taps in the same
browser reach `step_checked`; a yes with no taps is still a yes, so write it
down.

## Notes, one row per person

| # | Date | Browser | AI plan? | Stuck at (secs) | Rescued? | Tapped | Best quote | Steps done by day 7 |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
| 2 | | | | | | | | |
| 3 | | | | | | | | |
| 4 | | | | | | | | |
| 5 | | | | | | | | |

## Before recruiting strangers

Proposed, set now so the result cannot move it:

- Two or more of five stall at the same step: fix that step first.
- Fewer than four of five reach an AI plan: find out why before anyone else
  tries it.
- Otherwise move to the strangers in item 6.

## Check the telemetry

Run as the service role (Supabase SQL editor). Compare it with the notes
table: a person with no row used a browser that blocks telemetry.

```sql
with watched as (
  select distinct anon_id from telemetry_events
  where name = 'screen_viewed' and props->>'ref' = 'watched'
)
select
  w.anon_id,
  min(e.created_at)                                                  as first_seen,
  bool_or(e.name = 'plan_created' and e.props->>'source' = 'ai')     as ai_plan,
  string_agg(distinct e.props->>'useful', ', ')
    filter (where e.name = 'plan_rated')                             as rated,
  coalesce(max((e.props->>'checkedCount')::int)
    filter (where e.name = 'step_checked'), 0)                       as max_checked
from watched w
join telemetry_events e using (anon_id)
group by w.anon_id
order by first_seen;
```

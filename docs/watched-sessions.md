# Friend sessions (unwatched)

Step one of open item 6 in `HANDOFF.md`: five friends, each on their own
phone in their own pantry, on their own, then feedback afterwards. The point
is to find where people stall or misread before strangers hit the same wall.
These five do not count toward the stranger bar in item 6.

Not being in the room costs the two things watching gave: the moment someone
hesitates, and what they said while doing it. Recall afterwards is weak and
friends are kind, so the plan leans on three things instead:

- **Telemetry says where.** Each friend gets their own link, so the funnel
  shows the last screen they reached and how long each screen took.
- **A screen recording with voice says why**, if they agree to make one.
  It is the closest thing to watching. Ask, never push.
- **Their feedback fills in the rest**, collected as a voice memo right after,
  while it is fresh.

## Recruit

Text, not a call, so it is easy to say no:

> I built a thing that makes a step-by-step plan for a messy pantry from a
> few phone photos. Would you try it on yours sometime this week, on your
> own, and tell me honestly how it went? About 20 minutes.

Ask people whose pantry actually annoys them. A tidy pantry tests nothing.

## When they say yes

Give each friend their own number, 1 to 5, and send their link only:
`https://scmsolutions.org/tidymaps/?ref=friend-1` (then `friend-2`, and so
on). Write the number in the notes table before sending. Never open any of
these links on your own device: your visits are excluded by design.

Send this, as written:

> Thanks! Here's your link: https://scmsolutions.org/tidymaps/?ref=friend-1
>
> Do it on your phone, standing at your pantry with the door open. No need to
> sign up. Pretend you found this link yourself: go as far as you would on
> your own, and stop whenever you'd stop in real life. Please don't ask me
> anything while you're doing it. If you get stuck, that's exactly what I
> need to know.
>
> A big favor, only if you're up for it: turn on screen recording with the
> mic on, and say out loud what you're thinking as you go. Send me the video
> after.
>
> When you're done, text me "done" and I'll send four quick questions.

## Your rules

1. Never walk them through it, before or during.
2. If they text for help mid-way, reply "Do whatever you'd do if I weren't
   around," and log that screen as a stall.
3. If they have not started after three days, ask once. Someone who never
   starts is a result too: write it down.
4. When feedback arrives, do not explain or defend. The only follow-up is
   "What did you expect to happen there?"
5. Copy what they say word for word, not your reading of it.

## Four questions after

Send these when they text "done". Ask for a voice memo, not typing: people
say more, and more honestly, out loud.

> Thanks! Could you answer these as a voice memo?
> 1. In one sentence, what did this give you?
> 2. Where did you hesitate or get confused, if anywhere?
> 3. Which step would you do first, and when?
> 4. What would you have done instead of using this?

**Day 7:** text "Did you get to any of the steps?" Only taps in the same
browser reach `step_checked`; a yes with no taps is still a yes, so write it
down.

## What to look for in a recording or the timeline

| # | Screen | Look for |
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
| | Putting your plan together | Leaves the app during the wait, or gives up |
| | Results | First words; scrolls to the steps; taps a product |
| | How useful is this plan? | What they say vs what they tap |

If the app says the photos show a different setup from the card picked, note
whether they switch or keep, and why.

## Notes, one row per person

`AI plan?`, `Last screen` and `Longest screen` come from the SQL below.

| # | Link sent | Did it? | Recording? | AI plan? | Last screen | Longest screen (secs) | Texted for help at | Their one sentence | Steps done by day 7 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |

## Before recruiting strangers

Proposed, set now so the result cannot move it. A stall is any of: they quit
on that screen, they texted for help on it, or they spent over 60 seconds on
it (not counting the photo step or the plan wait).

- Two or more of five stall at the same step: fix that step first.
- Fewer than four of five reach an AI plan: find out why before anyone else
  tries it.
- Otherwise move to the strangers in item 6.

## Check the telemetry

Run as the service role (Supabase SQL editor). A friend who did it but has no
rows used a browser that blocks telemetry (Brave, DuckDuckGo, or Firefox with
Global Privacy Control; `docs/telemetry.md`, query 0). For them, the recording
and their answers are all there is.

One row per friend:

```sql
with friends as (
  select anon_id, max(props->>'ref') as friend from telemetry_events
  where name = 'screen_viewed' and props->>'ref' like 'friend-%'
  group by anon_id
)
select
  f.friend,
  min(e.created_at)                                                  as first_seen,
  bool_or(e.name = 'plan_created' and e.props->>'source' = 'ai')     as ai_plan,
  string_agg(distinct e.props->>'useful', ', ')
    filter (where e.name = 'plan_rated')                             as rated,
  coalesce(max((e.props->>'checkedCount')::int)
    filter (where e.name = 'step_checked'), 0)                       as max_checked
from friends f
join telemetry_events e using (anon_id)
group by f.anon_id, f.friend
order by f.friend, first_seen;
```

Their path, screen by screen. Each friend's last row is where they stopped;
its `secs_here` is empty because nothing came after it.

```sql
select
  props->>'ref'                                   as friend,
  props->>'screen'                                as screen,
  created_at,
  extract(epoch from lead(created_at) over w - created_at)::int as secs_here
from telemetry_events
where name = 'screen_viewed' and props->>'ref' like 'friend-%'
window w as (partition by anon_id order by created_at)
order by friend, created_at;
```

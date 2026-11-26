# TidyMap engineering handoff

What is deployed, what is true of production, what is open, and why the code
does the things that look arbitrary. Read it before changing anything.

**Last refreshed: 2026-11-26, main at 8d04a35 (after #246).** History (dated
sessions, scorecard, closed items, and the full pre-trim text of every
section condensed here) is in [`docs/handoff-archive.md`](handoff-archive.md).

**Git wins.** This doc is refreshed per session, not per merge, so it can
trail `main`. When it and `git log --oneline -20` disagree, git is right
(CLAUDE.md). Re-derive specifics before acting on them (open item 8).

## What the 2026-11-26 session changed

- **Landing "What you get" (#246).** The eye-level shelf from the after
  photo sits beside its zone. Zone labels, "3 of 9 done", prices, shelf names
  and the "How it works" numerals are olive, as is "and a reason" in the
  sample heading. The 3D print was recaptured from today's viewer: the old
  one predated item labels being hidden by default, so zone and item names
  overlapped.
- **Tried and dropped: a full-width dark band** behind the sample section
  (1278332, reverted in 778cc8c). The owner found it uninviting; do not
  propose it again. Rejected looks so far: cream with terracotta and pastel
  cards (11-24, read as AI-made), clinical white with square corners (09-07),
  the dark band (11-26). `DESIGN.md` Don'ts holds all three.
- **Skill advice not adopted.** ui-ux-pro-max suggested a purple palette and
  a testimonials carousel: there are no real testimonials and purple does not
  fit. taste-skill was useful only as a review checklist.
- **Landing is still frozen** (item 6). If it still feels bland after the
  friends, add real photos of a closet and a garage, not more coloured
  surfaces.

## Product state

Static ES-module site (no build step) on GitHub Pages at
`scmsolutions.org/tidymaps`; Supabase backend (Postgres + RLS, magic-code
auth, private `space-media` storage, Deno edge functions holding the AI keys;
BYOK is gone). An 11-step wizard over ten spaces and 37 setups (`js/router.js FLOW`) feeds `analyze-space`
(Sonnet 5.5 since 10-06). The plan reads as a report (wall tabs for rooms,
steps with where-lines, "Also in your photo", a shopping list from a
31-product catalog) and a 3D viewer with a builder per layout. Also: a
homepage, product library, dashboard, read-only share links, and an AI photo
preview (`render-after`, Gemini). Design: "The Marked-up Shelf" (`DESIGN.md`), all three stages landed.
Only the owner has used it (Production health #9); first users: item 6.

## Architecture crib sheet

- **Two plan shapes.** Raw (AI JSON or scenario output) -> `js/plan.js
  normalizeAi()` (idempotent) -> UI shape (`steps[{t,m,w}]`, `map[{lv,…}]`).
  `applyAnswers` takes raw, `applyCategoryEdits` normalized. User dims and
  shelf count always win in `normalizeGeometry`.
- **Two plan paths.** AI (`analyze-space`; `planSchema.js checkInvariants`,
  one retry with the errors, then the demo fallback) and deterministic
  (`js/demo-scenarios.js getDemoScenario`: no backend, AI failure, landing
  sample). `runDemo()` passes no answers and never autosaves.
- **Placement.** `js/placement.js placementFor` says which wall a row is on
  (`row.wall`, then layout section, then level-name prefix, then surface).
  The report, export and 3D view all read it. `js/planProvenance.js` decides
  whose plan it is (`planMeta.source==='ai'`, not `uploadedFiles`).
- **3D.** `js/layout.js` resolves an archetype; `js/three/scene.js` is the
  core, `js/three/layouts/` the builders (enum parity: `tests/layout.test.mjs`).
  Rooms draw boards per wall; `js/three/roomBoards.js` holds the shared rules
  (`roomPlanFor`, `roomFloorRun`, `roomRowRun`, `gapsAboveFor`,
  `rodClosetDepth`). Saved arrangements are version 3.
- **Fit is one rule in three places.** `js/catalog.js shelfDepthFor` /
  `rowHeadroomFor` (the card), `planSchema.js usableShelfDepth` (server), and
  the builders. Equality tests hold them together; change all or none.
- **State.** `js/state.js`. Draft `tidymap_draft_v2` never holds media;
  `state.shareView` blocks the draft writer and autosave. `prepareDemoPlanState`
  resets with no household (`adults = 0`); a share view blanks what it shows.
- **Async ownership.** A monotonic plan instance moves in `resetPlanRecord()`.
  Any async writer captures `currentPlanInstance()` and its inputs before the
  first await and writes nothing if `planInstanceIsCurrent()` is false.
  Re-reading `state` after an await is the bug this prevents.
- **Persistence.** Signed in: `autoSaveSpace()` creates the row (no photos),
  `updateSpacePatch()` debounces at 800ms, explicit save/share uploads media.
  Signed out: `persistGuestDraft()`, no media ever.
- **Step clips.** `remotion/` renders the 163 keys `enumerate-keys.mjs` lists
  (others keep the inline SVG) in a test-held copy of `tokens.css`: a palette
  change is a `--force` render (~20 min, `sheet.mjs` first, `check-edges.mjs`).
- **Telemetry.** `js/telemetry.js` -> `track-events`, re-sanitized against
  `_shared/telemetryEvents.js` (the server copy is the boundary). Off for
  DNT, GPC, `navigator.webdriver`, no `document`, and the in-app opt-out
  (`js/optout.js`, `tidymap_optout_v1`). `telemetryStatus()` says which.

## Backend / deploy state

- **Project** `jwubrtaacveavbkosgtf`. Use the Supabase MCP tools; the sandbox
  blocks direct HTTPS to `supabase.co` and `scmsolutions.org`. Edge logs keep
  24 hours; older answers come from `spaces.plan_meta` and `usage_events`.
- **Edge functions:** `analyze-space` (Sonnet 5.5, effort `medium`, thinking
  `between_tools`, `MAX_TOKENS` 12000, `TOTAL_BUDGET_MS` 100s),
  `render-after` (Gemini, 75s deadline under the client's 90s),
  `get-shared-space`, `track-events`, `submit-form`. All `verify_jwt: false`
  (they check JWTs themselves). Two entrypoint layouts: the first two deploy
  under `supabase/functions/...`, the other three under `functions/...`. A
  version bump does not prove a deploy: check `ezbr_sha256` changed.
- **Rate limits:** `analyze-space` signed in 10/hr 30/day, anonymous 3/hr
  6/day (300/day global); `render-after` 3/hr 5/day, anonymous 1/hr 1/day
  (100/day global). Breakers count anonymous calls only (#165).
- **CORS** (`_shared/cors.ts`): the github.io origin, `scmsolutions.org`,
  `www.scmsolutions.org`, `localhost:8000` and `:8123`. Port 3000 is not on
  it: a dev server there fails preflight and telemetry silently never sends.
- **Secrets.** Project: `ANTHROPIC_API_KEY` (dedicated, no expiry, rotated
  09-29), `GOOGLE_AI_API_KEY`, `IP_HASH_SALT`. Repo: `SUPABASE_ACCESS_TOKEN`,
  scoped to this project, read-write, **expires 2027-10-01** (open item 13).
  Keys expire silently and CI cannot see it (Production health #3).
- **What deploys on merge to `main`:** the site (`pages.yml` builds `_site/`
  with `scripts/build-site.sh` and inlines critical CSS, then a separate
  deploy job publishes it; re-run that job alone if it fails) and the functions
  when `supabase/functions/**` changed (`supabase-functions.yml`, also weekly
  Mon 06:17 UTC; no `--prune`, so deleting a function is manual). A red
  "Deploy edge functions" run means production functions differ from `main`.
- **Migrations are applied by hand.** 0001 to 0012 are applied (0010 to 0012
  checked 10-03). `0011` purges `usage_events` after 30 days and
  `telemetry_events` after 180 via `pg_cron`.
- **Scheduled checks:** `model-path-canary.yml` daily 06:20 UTC (calls the
  model; a failed run emails the owner; heartbeat fails past 36h);
  `product-availability.yml` Tue 06:41 UTC. Keep GitHub failure emails on.
- **CI gates** (`test.yml`, every PR): lint, `check:types`, `npm test`,
  Playwright. Every action is pinned to a commit SHA with its version in a
  comment (`tests/ci-pinned-actions.test.mjs`); nothing bumps them.

## Production health

Current as of 2026-10-13; numbers are stable (cited elsewhere; 08-27 archived).

1. Resolved: zero saved spaces (fixed 07-28).
2. **Analysis time: 5.5's median is 17.7s; 30.6s was its slowest run.**
   Measured 10-25, each saved AI plan from its `usage_events` row to its
   `plan_meta.analyzedAt`: 5.5 n=10, 11.2 / 17.7 / 30.1s; 4.6 n=2, 66.7 and
   75.5s. End to end, 12 of the 13 real calls. `TOTAL_BUDGET_MS` is 100s.
   No latency case for effort `low`: it stays `medium` unless cost says so.
3. **The model key can expire and nothing in the product shows it.** It did
   08-04 to 08-19 and again ~09-19; the client falls back to a demo plan
   behind an honest banner. Checks: the canary (open item 2) alerts; by hand,
   `plan_meta->>'source'` on recent `spaces` (`demo-fallback` = broken).
   `usage_events` has no status column and cannot tell you.
4. Resolved: XSS through plan icons (#134); the suite's telemetry (#98).
5. **Deploy token:** expires **2027-10-01**; dead, it is a 401 at deploy.
6. `render-after` works (fixed by 1568px input, #106). Proven re-staging on
   one corner pantry; object fidelity and other spaces unmeasured (item 1).
7. Telemetry is off in the owner's Chrome profile (`off: Do Not Track`,
   read 10-10), left off by decision.
8. **The live funnel works** (10-25): `?ref=selftest` on the deployed site,
   DNT off in that tab only, wrote a `screen_viewed` row per screen (ids 172
   to 175, deleted 10-25). No row since 08-04 is #7, not a break.
9. **No one but the owner has used the app** in the 30 days `usage_events`
   keeps (10-06, again 10-25): anonymous rows are the canary.
10. **The canary fires 44 minutes to 11 hours late** (GitHub cron is best
    effort). A same-day absence means nothing; the heartbeat allows 36h.
11. **Advisors:** eight notices, each a decision (four
    `rls_enabled_no_policy`, two on `handle_new_user`, `pg_net` in public,
    leaked-password protection off), plus INFO `unused_index` on #168's new
    indexes. A new one means something changed.
12. **Availability workflow fails weekly** (7/7 to 11-17, Amazon noise): 23.

## Testing & verification

```
npm ci                    # first: empty node_modules = ~800 phantom type errors
npm run lint && npm run check:types
npm test                  # 899 unit tests at 11-24
export CHROMIUM_PATH=/opt/pw-browsers/chromium   # the sandbox's stable launcher
npx playwright test       # 355 e2e + 1 standing skip at 10-25 (~15 min)
npm run check:model-path  # the canary, by hand
```

- Mock functions with `page.route('**/functions/v1/...')`; a faked session in
  `localStorage` (`saved-space.spec.mjs`) covers signed-in. Telemetry needs
  `--disable-blink-features=AutomationControlled` (webdriver suppresses it).
- Browser-test every user-facing change at 390 and 1280. Long specs:
  `demo-fit` and `three-setup-matrix` walk all 37 setups (~4 min).
- Run `--shard` halves in turn; together, the first to exit kills the server.
- **Fresh-session traps:** the sandbox cannot reach `supabase.co` (use MCP)
  or the live site; renders need the owner's browser; repo photos are
  <=1000px, so `assets/product/plan-shopping.png` is the render fixture.
- **Prove a new test fails without its fix** (CLAUDE.md), in a copy of the
  tree; never `git checkout` a file to undo a neuter (it reverts every change
  in it). Tests that passed against unfixed code: archive (#109's classic).

## Decisions that look arbitrary (still load-bearing)

- **`household.kids.present` / `pets.present` are `'yes'|'no'|null` strings
  derived from the counts, never truthiness-checked** (`null`: nobody
  answered, in demo and share). Cited by `js/state.js`, `sharePayload.js`.
- **The validator is never stricter than its prompt** (#43, scorecard #1).
  The enforced-limits block interpolates the validator's constants. Step caps
  are 12/18 words against a prompt asking 8/12 (item 4). Optional fields are
  dropped, never rejected (#184). Closet shelf needs are trimmed, not
  rejected (#192). Loosen prompt wording, never tighten the validator.
- **Two safety rules are deliberately unenforced:** daily-use items at 30 to
  60in (no "daily" marker to read) and heavy or fragile items low (they go
  low for kids, the opposite of chemicals and sharps). Archive scorecard #1.
- **The owner's own visits are excluded from analytics.** The owner's
  browser stays opted out (10-06); the owner never opens a tagged `?ref=`
  link; friend sessions use `?ref=friend-1` to `friend-5`; only `source='ai'` plans and
  `useful='Very useful'` count toward the first-users bar (#195, item 6).
- **No meta CSP, deliberately** (10-26). `index.html` has 93 inline `on*=`
  handlers and 116 inline `style=` attributes, so a CSP that does not break
  the app needs `'unsafe-inline'` for both, giving away the point. A real one
  means removing the handlers first; the rest need item 22's proxy, not a tag.
- **No em dashes in user-facing copy, US spelling.**
  `tests/copy-conventions.test.mjs` enforces both (09-02, #156).
- **Share links:** an allowlist (new fields excluded by default) plus a
  read-time pass that removes sentences matching the row's own household.
  `get-shared-space` must SELECT `household` to do that (test pins it).
  `steps[].goal`, `spotted` and all but `model/source/analyzedAt` of
  `plan_meta` stay out (#183, #165).
- **Photos persist only on explicit save or share.** Autosave uploads none;
  `render-after` stores output only once a photo was saved (#167); EXIF is
  stripped on intake (#165).
- **Telemetry:** an unknown event name is dropped silently, so a new event
  means editing `telemetryEvents.js` and redeploying `track-events`. Props are
  not checked per name. DNT/GPC are read before the in-app opt-out.
- **One fit rule.** Rooms have a 14-inch shelf floor; a rod closet's shelf is
  14 inches, its floor the whole closet (#191, #192); a walk-in floor is
  judged at its shelving's depth, the 3D view moved to match the card (owner's
  choice, #200). A room floor row's headroom ends at the lowest board (#198,
  revertible in `roomFloorRun`); printed max height is `floor(gap - T)`.
- **Even shelf spacing is `0.92*(i+1)/n` on client and server** (#192). A
  stored exact copy of the old 0.08 to 0.90 spread reads as "no heights".
- **Level matching ignores generic words** (`GENERIC_LEVEL_WORDS`, 09-03).
  Do not soften it back to shared-word matching.
- **3D viewer:** keep it (`img2threejs` replacement settled no). Env map is
  per material, never `scene.environment` (it relights every surface).
  Packing jitter is a hash, never `Math.random`.
- **Boot** is 32 modules, 134KB gzipped (#222, from 46 and 265): the report,
  analysis, Adjust and export load through `js/planScreens.js`, and a static
  import of one from the boot path fails `plan-screens.test`. Measured and not
  done: the builder thunk map, CSS concatenation, `modulepreload` (0.6s on
  slow 4G for a later headline; dropped 10-14, `early-click-guard.test`).
- **Advisor non-fixes** (`0009`): Production health #11, plus no captcha.
- **One type scale** (`--fs-*` in `tokens.css`, 8 set sizes and 6 fluid).
  A raw font-size fails `tests/type-scale.test.mjs`; half pixels went down.
- **A setup can add surfaces its archetype lacks** (`SETUP_SURFACES`): the
  reach-ins have a door, open shelving and a wardrobe do not (#210). A line
  about a fitting the setup lacks is dropped, not reworded (#212).
- **A multipack is bought by the pack** (`pack` in `catalog.json`, 10-25):
  the card, list, totals and export count packs, not units. Ranking still
  compares listing prices: per-need cost swapped ~50 sample picks to save
  $0.97 each. `catalog-packs.test` fails a "2 Pack" name with no `pack`.
- **Not dead, do not remove:** household counts and `state.detected` (#170
  audit). `plan.features` was removed symmetrically from prompt and schema.
- **Render:** 1568px input; parts order, `responseModalities` and the key are
  refuted causes. **Canary** heartbeat counts any completed run (#171-#179).
- **Removed on purpose:** unreferenced image keys (#52, #53;
  `tests/images.test.mjs` checks both directions), "Sort it again" (#181),
  "Schedule a session" (#46). `scrollToTop` jumps, not glides (#192).

## Open items / next actions

The live work list; numbers are stable, full 10-13 text in the archive.

### Actionable now

1. **Confirm the render holds across space types** (one corner pantry so
   far; compare object counts). Owner's browser, ~20 min (#109).
13. **Owner housekeeping:** delete the keys replaced 09-29; add an Anthropic
    billing alert; rotate `SUPABASE_ACCESS_TOKEN` before **2027-10-01**.
14. **Fridge (10-16).** Real run done 10-23. Left (owner: a person has to
    open the Target listing): replace the `note` on
    `idesign-fridge-freezer-bin-14x8x4-2pk`.
22. **No security headers on the live site** (F, 10-26). Needs a DNS move
    off Porkbun; not before item 6, only HSTS buys much. Archive has it all.

23. **Availability check:** fails only when two runs in a row flag a
    product (Amazon flickered, 11-24). Flipped 11-24: KUBBIS (two runs), the
    Home Edit XL bin and pantry labels (Walmart 404). Held, first flag only:
    five Walmart "out of stock" (Home Edit large bin, OXO 16" turntable, Smart
    Design door rack, both safety latches). Walmart stock is per-location and
    the checker has no zip, so read the 12-01 run or open them by hand before
    flipping; flipping both latches empties that category. Still to confirm:
    OXO POP medium, SimpleHouseware door organizer.

25. **Redesign follow-ups** (stages 1-3 landed 11-24). Unmade: the
    Dymo-label wordmark from the mock. `DESIGN.md` Layout, Elevation, Shapes
    and Components still describe Warm Shelf shapes in places ("terracotta",
    "pill"); rewrite them from the live CSS. Small pills left on purpose:
    toast, progress tracks, `.cab-item` chips in the after drawing.

26. **Landing follow-ups (11-26, after the freeze).** Not yet checked at
    768 and 1024px. The 3D viewer has no code that keeps labels from
    overlapping: the sample capture is clean, other setups or camera angles
    may not be.

Also open, unnumbered (from the dated sections):
- **After #192:** run a real reach-in or wardrobe with products on (shelf
  `maxDims.d_in` <=13.5 untrimmed, floor needs name the floor row, card and
  3D agree); reopen run 4c's plan, expect no fit note. The 10-18 failure
  watch closed unmeasured: edge logs keep 24h, `plan_meta` has no retry flag.

Closed: 2-5, 9-12, 15-17 (#217), 18-21 (#218-#221), 24 (live 11-24);
Spotted 4 (5.5) vs 8 (4.6): 4.6 padded; inputs differed, 5.5's recall untested (archive, 10-06).

### Waiting on traffic

6. **First users.** Only the owner has used it (re-checked 11-24: 30 days of
   rows are the canary). Pantry first; five unwatched friend sessions,
   one `?ref=friend-N` each (`docs/watched-sessions.md`), then 20 to 30 strangers,
   one `?ref=<slug>` per channel (`[a-z0-9-]{1,24}`). Bar: of the first 10, 6 get an AI plan, 4 tap "Very
   useful", 2 check 3+ steps in a week; a miss stops recruiting. Archive has
   the full plan and the join. The landing is frozen until all five friends
   have tried it. No links sent as of 11-26; next: send friend-1. Blocked on:
   owner recruiting.

### Waiting on business input

7. **Products.** Affiliate IDs in `js/affiliates.js` are empty, so all 31
   products link plain, no disclosure. `available:false` entries need an
   owner-checked replacement (`copco-basics-lazy-susan-9in`,
   `mdesign-open-front-bin-15in-2pk`, RISATORP, VARIERA, KUBBIS, Home Edit XL
   bin, Home Edit pantry labels). Want
   a drawer organizer under 12" wide, and fridge stock: a live fridge plan
   (11-24) matched 1 of 4 needs (no 12x5x14 bin, 4"-tall containers or date
   labels). After Amazon Associates approval, a job can fill `img`,
   `price_usd`, `available`, `checked` from PA-API.

### Known gap, no owner

8. **Every memory store drifts, this one included** (once 45 PRs stale).
   The vault and Notion copies point here instead of restating state.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge; open draft PRs, subscribe, re-check until merged. Run one session
on the open items at a time (10-25: item 14 was fixed twice). Each session
refreshes the header and dated section, old one to the archive; under 300 lines.

# TidyMap engineering handoff

What is deployed, what is true of production, what is open, and why the code
does the things that look arbitrary. Read it before changing anything.

**Last refreshed: 2026-10-23, main at 7c2aa6f (after #204), plus this session's PR.** History (dated
sessions, scorecard, closed items, and the full pre-trim text of every
section condensed here) is in [`docs/handoff-archive.md`](handoff-archive.md).

**Git wins.** This doc is refreshed per session, not per merge, so it can
trail `main`. When it and `git log --oneline -20` disagree, git is right
(CLAUDE.md). Re-derive specifics before acting on them (open item 8).

## What the 2026-10-23 session changed

First real fridge run (French door, AI, 12 rows) worked; the report and 3D
did not. #205: whole-word step pictures, door rows never make a room, unit
sections head the map, whole-word categories, drilling chip scoped. PR 2: 3D
fridge per card (`three/fridgePlan.js`), door rows on the door (cabinet too,
`cabinetShelfGeometry`), one surface and label per row (`three-unit-parts`).
PR 3: clips in the current palette (test-held), fridge/cabinet/vanity and open
drawer furniture, fridge glyphs, purge to floor bins, edge gate on renders.

## Product state

Static ES-module site (no build step) on GitHub Pages at
`scmsolutions.org/tidymaps`; Supabase backend (Postgres + RLS, magic-code
auth, private `space-media` storage, Deno edge functions holding the AI keys;
BYOK is gone). An 11-step wizard over ten spaces and 37 setups (`js/router.js FLOW`) feeds `analyze-space`
(Sonnet 5.5 since 10-06). The plan reads as a report (wall tabs for rooms,
steps with where-lines, "Also in your photo", a shopping list from a
31-product catalog) and a 3D viewer with a builder per layout. Also: a
homepage, product library, dashboard, read-only share links, and an AI photo
preview (`render-after`, Gemini). Design: "The Warm Shelf" (`DESIGN.md`).
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
  resets to wizard defaults (`adults = 2`); a share view blanks what it shows.
- **Async ownership.** A monotonic plan instance moves in `resetPlanRecord()`.
  Any async writer captures `currentPlanInstance()` and its inputs before the
  first await and writes nothing if `planInstanceIsCurrent()` is false.
  Re-reading `state` after an await is the bug this prevents.
- **Persistence.** Signed in: `autoSaveSpace()` creates the row (no photos),
  `updateSpacePatch()` debounces at 800ms, explicit save/share uploads media.
  Signed out: `persistGuestDraft()`, no media ever.
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
  with `scripts/build-site.sh` and inlines critical CSS) and the functions
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

Current as of 2026-10-13. Numbers are stable (other files cite them); the
archive has the 08-27 text, where 4 and 5 were each used twice.

1. Resolved: zero saved spaces (fixed 07-28).
2. Analysis time: within budget. `TOTAL_BUDGET_MS` 100s; Sonnet 5.5 ran a
   walk-in in 30.6s (one run, 10-06), owner runs on 10-10 in 12 to 22s.
3. **The model key can expire and nothing in the product shows it.** It did
   08-04 to 08-19 and again ~09-19; the client falls back to a demo plan
   behind an honest banner. Checks: the canary (open item 2) alerts; by hand,
   `plan_meta->>'source'` on recent `spaces` (`demo-fallback` = broken).
   `usage_events` has no status column and cannot tell you.
4. Resolved, two entries: stored XSS through plan icons closed in #134
   (09-14); the unit suite posting telemetry to production fixed in #98.
5. **Deploy token:** dead 09-14, replaced 10-03, expires **2027-10-01**. A
   dead token shows as a 401 at the deploy step and a red run. (The other #5,
   "the numbers are a smoke test", is superseded by #9.)
6. `render-after` works (fixed by 1568px input, #106). Proven re-staging on
   one corner pantry; object fidelity and other spaces unmeasured (item 1).
7. Telemetry is off in the owner's Chrome profile (`off: Do Not Track`,
   read 10-10), left off by decision.
8. The funnel is not broken: a clean browser sends (10-06). The 08-27 CORS
   argument was wrong; its conclusion held on the 10-06 edge logs.
9. **No one but the owner has used the app** in the 30 days `usage_events`
   keeps (10-06): anonymous rows are the canary, signed-in rows the owner.
10. **The canary fires 44 minutes to 11 hours late** (GitHub cron is best
    effort). A same-day absence means nothing; the heartbeat allows 36h.
11. **Advisors:** eight notices, each a decision (four
    `rls_enabled_no_policy`, two on `handle_new_user`, `pg_net` in public,
    leaked-password protection off), plus INFO `unused_index` on #168's new
    indexes. A new one means something changed.

## Testing & verification

```
npm ci                    # first: empty node_modules = ~800 phantom type errors
npm run lint && npm run check:types
npm test                  # 838 unit tests at 10-16
export CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
npx playwright test       # 344 e2e + 1 standing skip at 10-16
npm run check:model-path  # the canary, by hand
```

- Mock functions with `page.route('**/functions/v1/...')`; a faked session in
  `localStorage` (`saved-space.spec.mjs`) covers signed-in. Telemetry needs
  `--disable-blink-features=AutomationControlled` (webdriver suppresses it).
- Browser-test every user-facing change at 390 and 1280. Long specs:
  `demo-fit` and `three-setup-matrix` walk all 37 setups (~4 min).
- **Fresh-session traps:** the sandbox cannot reach `supabase.co` (use MCP)
  or the live site; renders need the owner's browser; repo photos are
  <=1000px, so `assets/product/plan-shopping.png` is the render fixture.
- **Prove a new test fails without its fix.** Break the specific behaviour
  the test claims to guard, in a copy of the tree (`git archive HEAD | tar -x
  -C <dir>`), confirm red, and diff the tree afterwards. Never `git checkout`
  a file to undo a neuter (it reverts every change in it). Stashing only
  proves the test needs the file. Examples of tests that passed against
  unfixed code are in the archive (#109's is the classic).

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
  link; watched sessions use `?ref=watched`; only `source='ai'` plans and
  `useful='Very useful'` count toward the first-users bar (#195, item 6).
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
- **Measured and not done:** the builder thunk map (54KB, lazy chunk); more
  boot deferral (item 12); CSS concatenation (slower). `modulepreload`, twice:
  09-14, and 10-13 (HTTP/2, 390px, median of 11): slow 4G boot 6.6 to 6.0s,
  paint unchanged; fast link boot 1.16 to 1.0s but LCP (the H1's font swap)
  about 0.2s later. Dropped by the owner 10-14: the early-click guard already
  keeps clicks made before boot, so the gain left is 0.6s on slow 4G against
  a later headline for most visitors and a 44-line list to maintain.
  `tests/early-click-guard.test.mjs` fails if the links come back.
- **Advisor non-fixes** (`0009`): `pg_net` in public, `handle_new_user`
  EXECUTE, policy-less RLS, no captcha or leaked-password check.
- **Not dead, do not remove:** household counts and `state.detected` (#170
  audit). `plan.features` was removed symmetrically from prompt and schema.
- **Render:** 1568px input; parts order, `responseModalities` and the key are
  refuted causes. **Canary** heartbeat counts any completed run (#171-#179).
- **Removed on purpose:** unreferenced image keys (#52, #53;
  `tests/images.test.mjs` checks both directions), "Sort it again" (#181),
  "Schedule a session" (#46). `scrollToTop` jumps, not glides (#192).

## Open items / next actions

The live work list. Numbers are stable (other files cite them); the full
original text is in the archive, "Open items: full text as of 2026-10-13".

### Actionable now

1. **Confirm the render holds across space types.** Proven on one corner
   pantry only. Run garages, closets, workbenches; compare object count with
   the input (the model once multiplied a container). Needs the owner's
   browser (~20 min); a failed render no longer costs quota (#109).
12. **The 2026-09-14 site review: residue only** (#134 to #174 shipped).
    Left: JSON-LD, `apple-touch-icon` (needs a PNG), the 72-character title,
    live-site headers and hosted auth config (sandbox cannot see them), the
    unreviewed "Last reviewed" dates on `cookies.html`/`accessibility.html`.
    Eager JS (41 boot modules) needs `landing.js`, `router.js`, `save.js`,
    `customize.js` and `wizard-data.js` untangled; walk the import graph first.
13. **Owner housekeeping** (not code): delete the Anthropic keys replaced on
    09-29; enable an Anthropic billing alert (the only check for a leaking
    key); rotate `SUPABASE_ACCESS_TOKEN` before **2027-10-01** with a
    calendar reminder, since nothing in the repo warns.
14. **Fridge (10-16).** Real run done 10-23. Left: replace the `note` on
    `idesign-fridge-freezer-bin-14x8x4-2pk`; multipacks price per bin.
15. **A reach-in's door rack draws as a shelf** (10-23): `shelves` has no
    door, and honesty turns AI door rows into shelf rows there. PR 3 (step
    pictures) is code-complete; its 163-clip re-render (~20 min) follows
    review. Then a type scale, keeping Archivo (PR 4).

Also open, unnumbered (from the dated sections):
- **After #192:** watch `analyze-space plan validation failed` for a rise
  through 10-18 (`09b1271`, merged 10-10); `seenLayout` cannot reject a plan,
  so a rise is #192's. Run a real reach-in or wardrobe with products on
  (shelf `maxDims.d_in` <=13.5 untrimmed, floor needs name the floor row,
  card and 3D agree); reopen run 4c's plan, expect no fit note. Not done yet.
- **Sonnet 5.5:** read several `analyze-space` times before quoting a
  speedup; try effort `low` only after a day at `medium`; the lower spotted
  count (4 vs 6 to 8) is a question, not a regression.

Closed (archive has the text): 2, 3, 4, 5, 9, 10, 11.

### Waiting on traffic

6. **First users.** Only the owner has used the app. Plan (10-11): pantry
   first; five watched sessions on `?ref=watched`, then 20 to 30 strangers,
   one `?ref=<slug>` per channel (`reddit-<sub>`, `nextdoor`, `fof-a`...;
   `parseRef` silently drops a slug outside `[a-z0-9-]{1,24}`). Bar, set
   first: of the first 10 strangers, 6 get an AI plan, 4 tap "Very useful",
   2 check off 3+ steps within a week; a miss means stop recruiting. Hold
   Google Ads until then. Join `screen_viewed` `props->>'ref'` to
   `plan_rated`/`step_checked` on `anon_id`. Blocked on: owner recruiting.

### Waiting on business input

7. **Products.** Affiliate IDs in `js/affiliates.js` are empty, so all 31
   products link plain with no disclosure. Two entries are
   `available:false` and need an owner-checked replacement
   (`copco-basics-lazy-susan-9in`, `mdesign-open-front-bin-15in-2pk`). Want
   a drawer organizer under 12" wide. After Amazon Associates approval, a
   job can fill `img`, `price_usd`, `available`, `checked` from PA-API.

### Known gap, no owner

8. **Every memory store drifts, this one included** (once 45 PRs stale).
   The vault and Notion copies point here instead of restating state.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history); open draft PRs, subscribe to PR
activity, re-check until merged. Each session refreshes the header and fills
its dated section; the previous one moves to the archive. Stay under 300 lines.

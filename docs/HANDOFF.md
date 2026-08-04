# TidyMap engineering handoff

A durable snapshot of what shipped, how it fits together, what's deployed, and
what's still open — so a fresh session (or human) can continue without
re-deriving anything.

**Last refreshed:** 2026-08-04, at the close of the session that moved the
feedback ask onto the report, verified the share link in a browser, and
**confirmed the AI analysis path works in production**. Everything through PR
#47 is merged; `main` is the single source of truth.

## Product state in one paragraph

Static ES-module site (no build step) served from GitHub Pages, with a Supabase
backend (project `jwubrtaacveavbkosgtf`): Postgres + RLS, magic-code auth,
private `space-media` storage, and Deno edge functions that hold the AI keys
(BYOK was removed; any `tidymap_key` in localStorage is scrubbed at startup).
The wizard follows the Claude Design 12-step contract: `landing → space (room)
→ area → setup → measure → capture (photos) → household → contents → goals →
style → effort → shopping → review → loading → results → customize → save →
feedback → done` (`js/router.js FLOW`; step data in `js/wizard-data.js`, step
rendering in `js/screens/wizard.js`). Around it: a marketing homepage that
leads with all nine areas, a product library page grouped by space, a
dashboard, a 3D viewer with a builder per layout archetype, and a read-only
shared-plan view.

## Scorecard: the original 8 handoff items

| # | Item | Status | PR |
|---|------|--------|----|
| 1 | Plan generation engine | ✅ shipped, and **confirmed live** 07-30 | #19 |
| 2 | Vision detection hardening | ✅ shipped | #20 |
| 3 | Imagery library pipeline | ✅ shipped (art itself pending, by design) | #20 |
| 4 | Step-media pipeline | ✅ shipped (clips pending, by design) | #21 |
| 5 | Products | ⏸ code done; blocked on business inputs | — |
| 6 | Persistence: share links + photo promise | ✅ shipped + deployed + walked | #23 |
| 7 | Automated QA (Playwright in CI) | ✅ shipped | #22 |
| 8 | Telemetry + feedback loop | ✅ shipped + deployed; **ask now on the report** | #24 |

### #1 Plan engine (PR #19)
`supabase/functions/analyze-space/index.ts` validates model output against a
zod schema (`_shared/planSchema.js`) with product invariants (categories only
from user selection, goal-driven steps never dropped, kid safety only when kids
present, effort caps, zero purchases on "use what I have"). One retry with
validation errors appended; second failure falls back to the deterministic
scenario engine. Fixture tests in `tests/`.

### #2 Vision hardening (PR #20)
- Prompt injection: `_shared/promptContext.js` wraps ALL user-typed context in
  a `<user_context>` block behind a standing guard instruction;
  `sanitizeUntrusted` strips control chars, defangs the delimiter token, caps
  length. The system prompt also declares text visible in photos to be objects,
  never instructions. Stored-XSS escaping in `results.js` untouched.
- Photo quality: `js/imageQuality.js` (brightness + variance-of-Laplacian)
  drives advisory "Too dark"/"Blurry" badges in `js/screens/capture.js`.

### #3 Imagery pipeline (PR #20, refined in #18)
`data/images.json` is the source of truth for every keyed image (file, alt,
license, `ready|pending`). `js/images.js hydrateImages()` fills ready images;
pending/unknown keys fall through to each slot's declarative `onerror`.
`tests/images.test.mjs` fails CI on undeclared keys, missing ready files, stray
pending files, missing alt/license, or stock/CDN hotlinks. 15 of 26 keys are
`ready`; the 11 pending ones are all photographs and flipping status to `ready`
is the whole ship step. See open item 5 for why that count overstates the gap —
nine of them are referenced by nothing at all.

### #4 Step-media pipeline (PR #21)
Clips are keyed `{action}-{motif}-{glyph}`: 13 `STEP_ART` scene types × 4
furniture motifs × 12 item glyphs. `js/stepMedia.js` owns the vocabulary,
`data/step-media.json` declares produced clips (empty today), and
`hydrateStepMedia()` lazy-loads `<video>` in-view for `ready` keys only. The
inline animated SVGs are both the spec each clip must match and the permanent
fallback. Guard: `tests/step-media.test.mjs`.

### #5 Products — still the one open business item
Catalog (`data/catalog.json`), dimension-fit matching (`js/catalog.js`),
feature-flagged affiliate tags (`js/affiliates.js`), and since PR #38 a
browsable product library page (`js/screens/products.js`). Blocked on business,
not code: deeper SKU curation and real affiliate/associate IDs. Product cards
draw their category (`js/product-art.js`) because no retailer photo can be
displayed without an image API (Amazon's needs an approved Associates account)
or a hotlink that breaks on URL rotation. Opt-in live link checker:
`npm run check:links` (not in CI — retailer bot-blocking false-fails from
datacenter IPs).

### #6 Share links + photo promise (PR #23) — DEPLOYED
- Migration `0005_sharing.sql`: unique nullable `spaces.share_id`.
- `get-shared-space` edge function (live, v1): rate-limited service-role
  lookup; response passes through the `_shared/sharePayload.js` **allowlist**
  (plan/zones/steps/dims only — household, progress, shopping, media, ids can
  never leak; new fields are excluded by default).
- Owner UX: "Share with family / roommate" on the save screen saves, mints, and
  copies `?share=<uuid>`. Nulling `share_id` revokes instantly.
- Visitor UX: read-only results view (banner, `data-owner-only` actions hidden,
  `state.shareView` blocks the guest-draft writer).
- Photo promise: guest drafts never serialize media (pinned by
  `tests/guest-privacy.test.mjs`); `clearGuestMedia()` drops in-memory copies at
  the done screen for signed-out users. `privacy.html` documents both.

### #7 Automated QA (PR #22)
`tests/e2e/wizard-matrix.spec.mjs` drives the real UI landing→plan for every
area: masthead matches space, map/steps/tags render, media keys valid,
measurements round-trip into the 3D status line, zero console errors/failed
local requests; kid/no-kid safety variants; product-link shape.
`.github/workflows/test.yml` runs `unit` + `e2e` on every PR.

### #8 Telemetry (PR #24, analysis layer 2026-07-28) — DEPLOYED
- Migration `0006_telemetry.sql`: `telemetry_events` (RLS, no policies).
- `track-events` edge function (live, v4) re-sanitizes every batch against
  `_shared/telemetryEvents.js`: 10-event allowlist, flat primitive props,
  80-char strings, 1KB/event, 25/batch. Client `js/telemetry.js`: random
  localStorage `anon_id`, debounce + flush-on-hide, honors DNT/GPC, disables
  under `navigator.webdriver`, fails silently.
- The allowlist gained `plan_rated` and `space_saved` on 2026-08-04. Adding an
  event means editing that file **and redeploying `track-events`** — the server
  copy is the boundary, and an unknown name is dropped silently, which looks
  exactly like a dead pipeline from the client side.
- The queries that answer the business question now live in
  `supabase/queries/telemetry.sql`, with `docs/telemetry.md` explaining what to
  read and in what order. **Read the findings there before planning
  product work** — the short version is in "Production health" below.

## What shipped since the first handoff (PRs #26–#40)

Mostly product surface and 3D, no backend changes except a layout schema.

- **Website redesign to the Claude Design handoff** (#27–#29): new homepage,
  room cards, portrait card treatment, and the wizard rebuilt to the 12-step
  contract. `0f0d493` added `npm ci` to the Pages deploy so `zod` resolves.
- **Wizard fidelity** (#30, #31, #36): print/PDF pass, cabinet photo fix,
  marketing footer hidden during the flow, static-closet motion and duplicate
  closet art fixed.
- **3D layout archetypes** (#32–#34): `js/three/` split into a core plus a
  builder registry (`js/three/layouts/`), with a builder per archetype
  (cabinet, closet-rod, closet-system, counter, drawer-bank, fridge, garage,
  l-run, …). `js/layout.js` resolves a layout from the space + setup + dims;
  chips and dimension sliders are driven from it; `ca484f3` added the
  layout/surface schema to the backend and a client/server enum parity test.
  Also in this run: mobile hamburger nav, mobile TOC, contrast fixes, and the
  "plan title always says pantry" bug.
- **Homepage and products** (#37–#40): the homepage leads with every area
  rather than the pantry, a product library page grouped by space, room labels
  and card alignment rewritten for legibility, and the "What you get"
  screenshots replaced by drawn explainers at their own size (a screenshot
  scaled three-across is a picture of 6px text).
- **Supabase CLI project setup** (`f0e2a30`) so migrations can run locally.

## What shipped in PRs #41–#47 (2026-07-28 → 07-30)

Recorded here because the previous refresh stopped at #40 and these are the
changes a fresh session is most likely to trip over.

- **#41** autosave (below) plus the before/after slider fix (below).
- **#42** the analysis-timeout budget (Production health #2), and one
  unreadable photo no longer cancels the whole analysis.
- **#43** plan validation stopped rejecting good plans over rules the model was
  never told, and the prompt now states the shelf-row cap the schema enforces.
- **#44** the plan hero and its "walk through it in 3D" button came back; kid
  options stop being offered to households that said there are no kids.
- **#45** closed a rate-limit bypass and an anonymous write path (both tables
  now go through `submit-form`); the 3D editor stopped discarding work; the
  Adjust options that claim to revise the plan actually revise it; product
  depth is checked against the shelf rather than the room; a second space no
  longer overwrites the first one's saved plan (`resetPlanRecord`).
- **#46** the save screen's "Download checklist" and "Send shopping list" became
  real (`js/planExport.js`); "Schedule a session" was removed rather than
  advertising a service that does not exist. A test walks `SAVE_OPTS` and fails
  if any label is offered without a handler.
- **#47** WebGL context failure recovers and explains itself; the plan's word
  count was cut at the prompt rather than the UI; a craft pass added depth,
  motion, and display-type tiers; `household.pets.types` and `household.notes`
  became real questions with a prompt rule behind them.

## What the 2026-07-28 session changed

Two user-reported bugs, both reproduced in a browser before being fixed.

**"The spaces I create don't save."** True, and worse than it sounded. Nothing
was ever written to `spaces` until the user found "Save plan", which lives two
screens past the report behind "Save & share" — and `updateSpacePatch()`
refuses to write progress, shopping, or 3D arrangement without an
`activeSpaceId`. So a signed-in user persisted *nothing*, while a signed-out
one at least kept a localStorage draft. Production confirmed it: zero rows in
`spaces`, ever, and zero `screen_viewed` events for the save screen.
- `autoSaveSpace()` in `js/db.js` creates the row the moment the plan exists
  (called from `finishLoading()` in `js/screens/loading.js`, both the success
  and AI-fallback branches), which also switches on incremental patches.
- It deliberately does **not** upload photos — `saveSpace(name, {media:false})`.
  Photo storage stays tied to an explicit save or share, which is what
  `privacy.html` promises; that page was updated to describe the split.
- `defaultSpaceName()` was a hardcoded 8-entry map from before the room → area
  wizard, so `drawers`, `dresser`, `bathroom`, `linen`, and `workbench` all
  saved as "My space" and showed "Space" on the dashboard. Both now derive from
  the plan's own `spaceType`, falling back to `areaFor()`.
- Guards: `tests/saved-space-naming.test.mjs`, `tests/e2e/saved-space.spec.mjs`
  (autosave writes once, with a real name, no storage traffic; signed-out
  writes nothing; explicit save still updates and uploads).

**"The after photo doesn't look different."** The comparison slider clipped the
AI render to the *left* of the divider while the tags read "Before" left and
"After · AI" right — so each half showed the opposite of its own label, and the
panel marked "After" was the user's original photo. One line of CSS
(`css/report.css`, `.ba-slider .after-img` clip-path). Guard:
`tests/e2e/before-after-slider.spec.mjs` samples rendered pixels under each tag.

Also delivered: `supabase/queries/telemetry.sql` + `docs/telemetry.md` (item
#4 of the previous open list).

## What this session changed (2026-08-04)

**The feedback ask moved onto the report.** Telemetry gave one unambiguous
reading: 15 `screen_viewed` for `results`, and **zero** for `customize`, `save`,
and `feedback`. The feedback screen is the last of nineteen and sits two screens
past the plan, so the question that decides what to build next was being asked
of nobody, and no amount of further waiting would have answered it. The ask now
lives under the finished plan (`#res-rate` in `index.html`, built by
`buildRate()` in `js/screens/feedback.js`), answering it unfolds the rest
inline, and the rating fires `plan_rated` the moment it is tapped rather than
when a form is completed. `state.fbRated` gates the event and `state.fbSent` the
database row, so one person answering in both places is counted once; the old
screen shows the answer back instead of asking again. That last part broke first
— `buildFeedback()` ran once at startup, so it read `fbSent` long before there
was anything to read, and it now rebuilds on entry the way `customize` and
`dashboard` already did.

**The share link was walked in a browser, and it was claiming two adults.**
`applySharedSpace()` resets through `prepareDemoPlanState()`, which leaves the
wizard's default `household.adults = 2` behind, and the report masthead renders
whatever household it finds. Not a leak — the allowlist strips household and it
never crossed the wire — but a stranger was being shown "2 adults" on someone
else's plan, which is a plain statement of something nobody said. Share view now
blanks the household outright. New suite: `tests/e2e/shared-plan-view.spec.mjs`.

**Also:** the report's shopping card had two buttons that toasted "Shopping list
saved" and "List sent" without doing either — the same defect PR #46 removed
from the save screen, still live one screen earlier. Both call the real
exporters now. And `space_saved` + `cache_control` landed (see below).

## Production health as of 2026-08-04

1. ~~Zero saved spaces~~ — fixed 07-28.
2. ~~**`analyze-space` timing out in production**~~ — fixed, deployed, and now
   **confirmed working end to end.** The symptom was a **546 after 150.2
   seconds**: Supabase's wall-clock limit, hit by two unbounded model calls,
   returning no body at all. `EFFORT` is explicit (`medium`), thinking is pinned
   off, and the handler is measured against `TOTAL_BUDGET_MS` (100s).
   - **The confirmation, since "fixed" was previously only a claim about the
     code:** the one row in `spaces` carries
     `plan_meta = {"source":"ai","model":"claude-sonnet-4-6","analyzedAt":
     1785373371923}`. That is 2026-07-30 01:02:51, and `usage_events` has the
     `analyze-space` call at 01:01:37 — **74 seconds, inside the budget.** Its
     summary describes a real walk-in pantry with L-shaped shelving, text that
     appears in no `js/demo-scenarios.js` entry. The AI path works.
   - The `output_config.effort` / `thinking` tuning is therefore also fine in
     practice, since that run used it. `cache_control` shipped in this session
     and has **not** been exercised — the same caveat applies, and the fallback
     now strips it too. Grep the edge logs for
     `model rejected effort/thinking/cache tuning` before assuming otherwise.
3. **Telemetry is suppressed for the owner's own testing.** `usage_events`
   shows edge-function calls; `telemetry_events` has nothing after 2026-07-23
   from that browser. This is Do Not Track / Global Privacy Control doing
   exactly what it should. Do not read a quiet week as low usage — check
   `usage_events` first (query 0 in the SQL file).
4. **The numbers are a smoke test, not a trend.** As of 2026-08-04: 1 user,
   1 saved space, 1 feedback row, 93 telemetry events, 79 usage events, and
   nothing at all since 2026-07-30. `analyze-space` has been called 13 times
   ever. Do not reason about conversion from this.

## Architecture crib sheet

- **Two plan shapes.** Raw (AI JSON / scenario output: `steps[{task,time,why}]`,
  `map[{level,zone,icon,why,eye,shelfIndex,safety,items}]`, `productNeeds`) →
  `normalizeAi()` in `js/plan.js` → normalized UI shape (`steps[{t,m,w}]`,
  `map[{lv,zone,ic,why,...}]`). `applyAnswers` is raw; `applyCategoryEdits` is
  normalized. User dims/shelf count always win in `normalizeGeometry`.
- **Two plan paths.** AI (`analyze-space`, invariants server-side) and
  deterministic (`js/demo-scenarios.js getDemoScenario(space, goal, household,
  answers)`), used for demo capture, no backend, and AI failure. `runDemo()` on
  the landing passes no answers on purpose (pure sample) and never autosaves —
  it bypasses `finishLoading()` entirely.
- **3D.** `js/layout.js` resolves an archetype from space + setup + dims;
  `js/three/scene.js` is the core and `js/three/layouts/index.js` the builder
  registry. Adding an archetype = adding a builder plus its enum entry on both
  sides (parity test in `tests/layout.test.mjs`).
- **State.** `js/state.js`. Guest draft `tidymap_draft_v2` never contains media;
  `state.shareView` blocks the draft writer *and* autosave;
  `prepareDemoPlanState` is the canonical reset. Careful with that last one in
  `applySharedSpace`: it resets to the wizard's *defaults*, not to empty, and
  those defaults include `household.adults = 2`. Anything the report renders
  from state has to be blanked explicitly for a share view, or the visitor is
  shown a default as though it were the owner's answer.
- **Persistence.** Signed in: `autoSaveSpace()` creates the row,
  `updateSpacePatch()` debounces incremental writes (progress, shopping,
  arrangement) at 800ms, explicit save/share uploads media. Signed out:
  `persistGuestDraft()` to localStorage, no media, ever.
- **Wizard answers.** `prefs` (Set of 13), `budget`, `effort`, `detail_*`
  toggle keys on state, `dims{w_in,h_in,d_in,shelves}`, `household` (`present`
  is `'yes'|'no'|null` STRINGS — never truthiness-check), `cats`
  (authoritative after review edits).
- **Personalization (PR #25).** `js/personalize.js` makes the deterministic
  path honor every wizard answer (the AI path already does, server-side — do
  not double-apply). `applyAnswers(rawPlan, answers)` runs inside
  `getDemoScenario`; `applyCategoryEdits(normalizedPlan, cats)` runs on BOTH
  paths when leaving review. Core pattern: `ensureCitedStep` — cite the user's
  answer verbatim on an existing matching step, add one only if nothing covers
  it; `_p`-flagged and safety steps survive trimming.

## Backend / deploy state

- Migrations applied: 0001 init, 0002 storage, 0003 feedback,
  0004 invite_requests, 0005 sharing, 0006 telemetry,
  0007 atomic_usage_and_storage.
- Edge functions live: `analyze-space` (v14), `render-after` (v11),
  `get-shared-space` (v4), `track-events` (v4), `submit-form` (v1). All
  `verify_jwt: false` — they check JWTs themselves so guests can call them.
  CORS allowlist in `_shared/cors.ts` (Pages, scmsolutions.org, tidymaps.ai,
  localhost:8000/8123).
- **`analyze-space` is one version behind this branch.** The `cache_control`
  change is committed but NOT deployed: it is an unreviewed change to the live
  AI path, so it should go out with the PR rather than ahead of it. `v14` is
  still the pre-`cache_control` build. `track-events` v4 already carries the new
  allowlist, because an additive allowlist has to lead the client that sends to
  it, not follow.
- Note the two entrypoint layouts, which are not interchangeable:
  `analyze-space` and `render-after` deploy under `supabase/functions/...`,
  while `get-shared-space`, `track-events`, and `submit-form` deploy under
  `functions/...`. Bundle `_shared/*` and `import_map.json` at the matching
  depth or the imports do not resolve.
- Deploys go through the Supabase MCP tools (`apply_migration`,
  `deploy_edge_function` with the `_shared/*` files bundled alongside the
  entrypoint). The CCR sandbox's network policy blocks direct HTTPS to
  `supabase.co` — use MCP, not curl, and don't mistake that 403 for an outage.

## Testing & verification

- `npm install` first — `zod` is a runtime dependency of the shared plan
  schema, and two unit files fail with `ERR_MODULE_NOT_FOUND` without it.
- `npm test` — Node built-in runner over `tests/*.test.mjs`.
- `npx playwright test` — `tests/e2e/`, config `playwright.config.mjs`, python
  http.server on :8123. In this sandbox the Playwright-managed browser isn't
  installed; run with
  `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- CI: `.github/workflows/test.yml` on every PR. Pages deploy: `pages.yml` on
  push to main.
- Two habits that keep paying off: browser smoke-test every user-facing change
  rather than reasoning about it, and mock the edge functions with
  `page.route('**/functions/v1/...')` when the backend isn't reachable. A faked
  Supabase session in `localStorage` (see `tests/e2e/saved-space.spec.mjs`)
  makes the whole signed-in surface testable offline.
  - The 07-28 session found both its bugs by screenshotting pixels and reading
    the wire, and one looked like a model-quality problem right up until it
    didn't. The 08-04 session found two more the same way: the feedback screen
    still asking a question already answered, and the share view claiming two
    adults. Neither was visible in the code, and neither unit test would have
    caught them.
- **Do not use `git checkout <file>` to test whether a new test fails without
  its fix.** It reverts every change in that file, not the one line you sed'd,
  and it happened twice in the 08-04 session. Copy the file aside and restore
  from the copy, or revert the edit with the inverse edit.

## Closed since the last refresh

- ~~Confirm the AI path completes~~ — confirmed from stored `plan_meta`
  (Production health #2). This one is settled; do not re-open it on the
  strength of `plan_created` telemetry alone, which still reads all-`demo`
  because the only AI run happened in a browser sending GPC.
- ~~Live share-link round trip~~ — a link is minted on the saved pantry and the
  visitor's half is covered by `tests/e2e/shared-plan-view.spec.mjs`. It found
  the "2 adults" bug. See the caveat in open item 2 below.
- ~~Feedback on the results screen~~ — shipped this session.
- ~~`space_saved` telemetry event~~ — shipped and deployed (`track-events` v4).
- ~~`cache_control` on the retry~~ — committed, **not deployed** (see
  Backend / deploy state).

## Open items / next actions

1. **Deploy `analyze-space`** once this PR is reviewed. The `cache_control`
   change is in the branch and `v14` in production is without it. Nothing in
   CI can call the real API, so watch the first live analysis and grep the edge
   logs for `model rejected effort/thinking/cache tuning`.
2. **The share round trip is verified client-side, not over the wire.** The
   sandbox blocks HTTPS to `supabase.co`, so `tests/e2e/shared-plan-view.spec.mjs`
   mocks `get-shared-space` and everything downstream of the response is real.
   The remaining 30 seconds of work is a human one: open
   `https://scm-solutions-llc.github.io/tidymaps/?share=1d6dcc74-5b57-486a-bc45-afb14524c5a0`
   in a signed-out window and confirm a banner and a plan come back. Revoke
   afterwards with `update spaces set share_id = null where id =
   'e19b0766-3507-4c5a-b7d2-e78f67c4706e';` — that link is live right now.
3. **Wait for the funnel to say something.** `plan_rated` is the new primary
   signal and it has zero rows, because the ask shipped after the last session
   of real usage. Read `plan_rated` before `feedback_submitted`: the first is
   one tap on the report, the second needs someone to walk three more screens.
   Both are joinable to `step_checked` depth per `anon_id`.
4. **#5 products:** SKU curation + real affiliate IDs (business), then flip the
   flags in `js/affiliates.js`. Every entry is still an empty string, so all 30
   catalog products link plain and no disclosure renders.
5. **Media production (design-owned).** The pending count overstates this. All
   11 pending manifest keys are photographs, but only `hero-home` and
   `sample-after` appear as `data-img` anywhere — the nine `wiz-room-*` /
   `wiz-area-*` entries are a shot list, referenced by nothing, and the wizard
   draws SVG art instead. `hero-home` already has a working declarative `src`
   (`pantry-after.png`); its pending entry is an upgrade, not a hole. **Nothing
   on the site is broken for want of these.** Step clips are likewise still
   empty (`data/step-media.json`) with the inline SVGs as the permanent
   fallback. Note that `tests/images.test.mjs` only checks that referenced keys
   are declared, never that declared keys are referenced, which is why 24
   unused entries sit there quietly.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history), open draft PRs, subscribe to PR
activity, and re-check open PRs on a timer until they merge.

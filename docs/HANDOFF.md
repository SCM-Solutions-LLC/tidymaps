# TidyMap engineering handoff

A durable snapshot of what shipped, how it fits together, what's deployed, and
what's still open — so a fresh session (or human) can continue without
re-deriving anything.

**Last refreshed:** 2026-08-05, at the close of the session that moved the
feedback ask onto the report, **verified the share round trip against
production**, deployed the `analyze-space` step-length caps, and cleared
twenty-one dead entries out of the imagery manifest. Everything through PR #53
is merged; `main` is the single source of truth.

Read the open items with one thing in mind: **all four are waiting on someone
using the app, not on code.** Nothing below is blocked on a change anybody can
write.

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
| 3 | Imagery library pipeline | ✅ shipped; manifest now 5 keys, 1 photo pending | #20, #52, #53 |
| 4 | Step-media pipeline | ✅ shipped (clips pending, by design) | #21 |
| 5 | Products | ⏸ code done; blocked on business inputs | — |
| 6 | Persistence: share links + photo promise | ✅ shipped + deployed + **proven in production** | #23 |
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
pending files, missing alt/license, stock/CDN hotlinks, and — since 2026-08-04
— any declared key nothing references. The manifest is down to 5 keys, 4 of
them `ready`; the one pending key is `hero-home`, a photograph, and flipping
status to `ready` is the whole ship step. Twenty-one entries came out on
2026-08-04 — seventeen wizard card photos the design had superseded with line
art, and four landing screenshots commit 2265978 had replaced with drawn
explainers. Both were superseded work reading as owed work; see
`docs/asset-plan.md` for why they went and why they should not come back.

### #4 Step-media pipeline (PR #21; produced clips landed 2026-08-10)
Clips are keyed `{action}-{motif}-{glyph}`: 13 `STEP_ART` scene types × 4
furniture motifs × 12 item glyphs. `js/stepMedia.js` owns the vocabulary,
`data/step-media.json` declares produced clips, and `hydrateStepMedia()`
lazy-loads `<video>` in-view for `ready` keys only — and now skips the
upgrade entirely under `prefers-reduced-motion`, since the CSS stills the
SVG scenes and a clip would have brought the motion back. The inline
animated SVGs are both the spec each clip must match and the permanent
fallback. Guard: `tests/step-media.test.mjs`.

Production lives in `remotion/` (see its README): one parameterized Remotion
composition ports each scene's CSS keyframes onto a wide stage in the site's
palette, `enumerate-keys.mjs` derives the producible key list (demo-matrix
union + each space's default pair × all actions), and `render-steps.mjs`
renders VP9 WebM to `media/steps/` and rebuilds the manifest. The clips bake
the `--surface-2` band color and the token palette — a palette change means
re-rendering (`node render-steps.mjs --force`). Keys outside the produced
set keep their SVG scene by design.

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
- The allowlist is only the first of two passes, because the plan TEXT is
  written from the household: analyze-space is asked to name a child's age in
  a row's `safety.why` and to answer the free-text note, and offline
  `applyNote()` quotes that note back verbatim into `opportunities`. So
  `sharePayload.js` also (a) drops the plan's household section outright —
  `safetyNotes`, every row's `safety`, `steps[].cite`, the `kid-frequent` item
  flag — and (b) checks what survives against the row's OWN stored household
  (ages, pet types, reach needs, distinctive note words) and removes any
  sentence that still matches. Closed set, not PII guessing: the row says what
  to look for. It runs at READ time, so links minted before it exist are
  covered. `get-shared-space` therefore SELECTs `household` in order to remove
  it — dropping that column from the query silently disarms the whole second
  pass, which is why `tests/backend-contracts.test.mjs` asserts it.
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

## What this session changed (2026-08-04 → 08-05, PRs #48–#53)

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

**Then the manifest turned out to be describing work nobody owed.** `#52` and
`#53` removed twenty-one entries from `data/images.json` — seventeen `wiz-*`
wizard card photos and four landing screenshots. Every one was unreferenced,
and in both cases the design had already decided against them: the wizard
settled on line art (`css/components.css` requires one "line-art language",
and `wizard-illustration-motion.spec.mjs` requires a detail that *moves at
rest*, which a photo cannot), and commit 2265978 replaced the screenshots with
drawn explainers because an app screenshot at three-across is "a picture of
text at 6px". They read as a shot list because the guard only ever checked
that referenced keys were declared, never that declared keys were referenced.
It now checks both, so the same drift cannot rebuild quietly.

The lesson generalizes past imagery: **an entry nothing references is far more
often a decision someone already made than work still owed.** Both batches had
a plausible "staged for later" story, and both were wrong — the git history
said so in each case. Check it before believing the backlog.

## Production health as of 2026-08-05

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
4. **The numbers are a smoke test, not a trend.** As of 2026-08-05: 1 user,
   1 saved space, 1 feedback row, 99 telemetry events (last 08-04 16:16 UTC),
   92 usage events (last 08-04 18:03 UTC). Do not reason about conversion from
   this.
   - **`analyze-space` has been called 13 times ever, and that number has not
     moved since 2026-07-30.** It is the cleanest single check on open item 1:
     if it still reads 13, neither `cache_control` nor the v16 step caps have
     run in production, whatever else the tables show. The 08-04 activity was
     share-link traffic and this session's own testing, not a new analysis.

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
- **Async ownership (plan instance).** `state` is one shared object and almost
  every writer writes after an await, so each one has to prove it still owns
  the plan it started on. `js/state.js` keeps a monotonic **plan instance** id
  that moves inside `resetPlanRecord()` — i.e. on Start over, opening a saved
  space, a share link, `setArea()`, and the demo. The contract for any async
  operation: capture `currentPlanInstance()` and snapshot everything it needs
  (media, `activeSpaceId`, render instructions, the row) BEFORE the first
  await, then write nothing if `planInstanceIsCurrent()` is false. The
  dashboard calls `startPlanInstance()` at the *click* rather than at the
  response, so the card tapped last wins. Rebuilding a plan for the same space
  is not a new instance — the analysis has its own run token in
  `js/screens/loading.js` for that, and checks both. `openSavedSpace()` and
  `snapshotSave()`/`persistSpace()` are the guarded halves of what used to be
  `loadSpace()` and `saveSpace()`; re-reading `state` after an await is the
  bug the whole mechanism exists to prevent.
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
- Edge functions live: `analyze-space` (v16), `render-after` (v11),
  `get-shared-space` (v4), `track-events` (v4), `submit-form` (v1). All
  `verify_jwt: false` — they check JWTs themselves so guests can call them.
  CORS allowlist in `_shared/cors.ts` (Pages, scmsolutions.org, tidymaps.ai,
  localhost:8000/8123).
- **Production matches `main` as of 2026-08-04.** `analyze-space` v16 carries
  the step-length caps (task ≤8 words verb-first, why ≤12) and tells the model
  the step animation exists, deployed after PR #50 merged rather than ahead of
  review, same as v15's `cache_control` after #48; `track-events` v4 carries
  the `plan_rated` / `space_saved` allowlist, which went out *before* the
  client because an additive allowlist has to lead the client that sends to it.
- After a `deploy_edge_function`, read the function back with
  `get_edge_function` and check the changed regions actually landed. The MCP
  tool takes file contents inline, so a deploy is a transcription of the repo
  rather than an upload of it, and nothing else catches a bad copy.
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
- ~~Live share-link round trip~~ — **closed over the wire, 2026-08-04**, not
  just in a mock. `tests/e2e/shared-plan-view.spec.mjs` covers the visitor's
  half client-side (it found the "2 adults" bug), but the proof is in
  production: edge logs show a run of `get-shared-space` 200s that afternoon,
  and `telemetry_events` carries three `shared_plan_viewed` rows under three
  distinct `anon_id`s (15:10, 15:14, 16:16 UTC) — real visits an hour apart,
  not one test run, and not the e2e spec, which mocks the function and cannot
  reach production from the sandbox anyway. The link was then revoked
  (`spaces.share_id` null, `updated_at` 17:53) and the `get-shared-space` 404s
  after that timestamp exercise the revoke path too. Both halves are done; no
  live share link is outstanding.
- ~~Feedback on the results screen~~ — shipped this session.
- ~~`space_saved` telemetry event~~ — shipped and deployed (`track-events` v4).
- ~~`cache_control` on the retry~~ — shipped and deployed (`analyze-space` v15).
- ~~Step-length caps in the prompt~~ — shipped and deployed (`analyze-space`
  v16). The old prompt bounded map-row whys at 14 words and said nothing at all
  about step length, so a 9-word step was never out of spec.
- ~~Dead imagery-manifest entries~~ — 21 removed across #52 and #53, and a
  reachability guard added so they cannot rebuild silently. Both batches read
  as art still owed and were in fact decisions already made: seventeen `wiz-*`
  card photos (the design chose line art) and four landing screenshots (commit
  2265978 replaced them with drawn explainers). Nothing on the site changed —
  nothing had referenced any of them.

## Open items / next actions

1. **Watch the first live analysis after 2026-08-04.** Two unexercised changes
   now ride on it, and they fail in different ways. Still unexercised as of
   2026-08-05: `select count(*) from usage_events where fn = 'analyze-space'`
   reads **13**, unchanged since 2026-07-30, and the last `plan_created` was
   2026-07-30 05:09 UTC. Re-run that count first — while it says 13, nothing
   below has run in production and there is nothing to check yet.
   - `cache_control` (v15) has never been called: nothing in CI can reach the
     real API, and the last real analysis predates it. A 200 in a plausible
     time means it is fine. If the API rejects the tuning, the function drops
     it and carries on slow rather than broken — grep the edge logs for
     `model rejected effort/thinking/cache tuning` before assuming otherwise.
     The same caveat no longer applies to `effort`/`thinking`, which the
     2026-07-30 run used successfully.
   - The v16 step caps cannot fail loudly at all. Nothing validates step
     length server-side — `planSchema.js` only requires `task`/`time`/`why` to
     be strings — so a model that ignores the 8-word cap produces a plan that
     passes validation and renders long. Read the steps on the first real
     report rather than trusting the 200. If they run long, the cap needs to
     move into `checkInvariants`, where a violation costs a retry instead of
     shipping.
2. **Wait for the funnel to say something.** Still nothing to read, confirmed
   2026-08-04: `plan_rated` and `space_saved` have **zero rows** — neither name
   appears in `telemetry_events` at all. The only names present are
   `screen_viewed` (92), `shared_plan_viewed` (3), and `plan_created` (4, none
   since 2026-07-30). `feedback` holds one row, from 2026-07-29. Read
   `plan_rated` before `feedback_submitted`: the first is one tap on the
   report, the second needs someone to walk three more screens. Both are
   joinable to `step_checked` depth per `anon_id`.

   One caveat on reading `feedback_submitted` against the `feedback` table:
   until the item-4 fix, the event fired beside the write rather than after
   it, and the write's failure was swallowed — so any historical gap between
   the count and the row count is that bug, not a load or a join. From now on
   the event is only sent once the server has confirmed the row, so the two
   should agree.
3. **#5 products:** SKU curation + real affiliate IDs (business), then flip the
   flags in `js/affiliates.js`. Every entry is still an empty string, so all 30
   catalog products link plain and no disclosure renders.
4. **Media production (design-owned).** Now one slot, not eleven. The wizard
   card photo plan was retired on 2026-08-04: seventeen `wiz-*` entries went,
   because the design had already settled on line art (`css/components.css`
   requires one "line-art language" across every card, and
   `wizard-illustration-motion.spec.mjs` requires a detail that *moves at
   rest*, which a photograph cannot do). Nothing referenced them, so nothing
   changed on the site. See `docs/asset-plan.md` before re-adding any.
   The single pending key left is `hero-home`, and it already has a working
   declarative `src` (`pantry-after.png`) — an upgrade, not a hole. Step clips
   are no longer empty: `remotion/` renders them programmatically from the
   `STEP_ART` spec (2026-08-10), so this slot moved from design-owned photo
   work to a re-runnable build step. The inline SVGs remain the permanent
   fallback for any key outside the produced set.
   **Nothing on the site is broken for want of these.**
   The reverse guard now exists (`tests/images.test.mjs` fails on a declared
   key nothing references), so this class of drift cannot rebuild silently.
   The same guard then caught a second batch: `plan-map`, `plan-steps`,
   `plan-shopping`, and `wizard-household`, which commit 2265978 had removed
   from the landing page on purpose (an app screenshot at three-across is "a
   picture of text at 6px") and replaced with drawn explainers. Their entries
   went too on 2026-08-04; the files stay on disk for any future page that
   shows a screenshot at readable size. `UNREFERENCED_OK` is now empty and
   should stay that way — both batches that would have gone in it turned out
   to be decisions already made, not art still owed. Only `hero-3d.png`
   remains in use, as the hero's `onerror` fallback.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history), open draft PRs, subscribe to PR
activity, and re-check open PRs on a timer until they merge.

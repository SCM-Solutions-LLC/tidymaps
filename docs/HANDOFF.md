# TidyMap engineering handoff

A durable snapshot of what shipped, how it fits together, what's deployed, and
what's still open — so a fresh session (or human) can continue without
re-deriving anything.

**Last refreshed:** 2026-07-28, at the close of the session that fixed
persistence and the before/after comparison, and delivered the telemetry
analysis layer. Everything through PR #40 is merged; `main` is the single
source of truth.

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
| 1 | Plan generation engine | ✅ shipped | #19 |
| 2 | Vision detection hardening | ✅ shipped | #20 |
| 3 | Imagery library pipeline | ✅ shipped (art itself pending, by design) | #20 |
| 4 | Step-media pipeline | ✅ shipped (clips pending, by design) | #21 |
| 5 | Products | ⏸ code done; blocked on business inputs | — |
| 6 | Persistence: share links + photo promise | ✅ shipped + deployed | #23 |
| 7 | Automated QA (Playwright in CI) | ✅ shipped | #22 |
| 8 | Telemetry + feedback loop | ✅ shipped + deployed | #24 |

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
pending files, missing alt/license, or stock/CDN hotlinks. The two real photos
(`hero-home`, `story-before`) remain `pending` — flipping status to `ready` is
the whole ship step.

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
- `track-events` edge function (live, v1) re-sanitizes every batch against
  `_shared/telemetryEvents.js`: 8-event allowlist, flat primitive props,
  80-char strings, 1KB/event, 25/batch. Client `js/telemetry.js`: random
  localStorage `anon_id`, debounce + flush-on-hide, honors DNT/GPC, disables
  under `navigator.webdriver`, fails silently.
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

## What this session changed (2026-07-28)

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

## Production health as of 2026-07-28

Three things found while diagnosing the above. Two are fixed.

1. ~~Zero saved spaces~~ — fixed above.
2. ~~**`analyze-space` timing out in production**~~ — fixed and deployed
   (function v10). The symptom was a **546 after 150.2 seconds**: Supabase's
   wall-clock limit, hit by two unbounded model calls, returning no body at
   all. The deterministic engine covered for it, so the only visible symptom
   was a two-and-a-half-minute wait and a plan that was never the AI's — every
   recorded plan is `source: 'demo'`. Two causes: Sonnet 4.6 runs at `high`
   effort unless told otherwise and this function never told it otherwise, and
   the post-validation retry re-sends every photo. Now `EFFORT` is explicit
   (`medium`), thinking is pinned off, and the whole handler is measured
   against `TOTAL_BUDGET_MS` (100s) — each attempt gets what's left via
   `AbortSignal.timeout`, a retry runs only above `MIN_RETRY_MS`, and running
   out returns a 504 the client explains. `MODEL` stays `claude-sonnet-4-6`,
   which is current and active; it was not the problem.
   - **Still unverified:** nothing in CI can call the real model, so the
     `output_config.effort` / `thinking` parameters shipped untested against
     the live API. If it rejects them the function drops the tuning, logs
     `model rejected effort/thinking tuning`, and carries on slow rather than
     broken. Grep the edge logs for that string before assuming it's fine.
   - Not done, and worth doing if retries stay common: `cache_control` on the
     first user turn would make the retry re-read the photos from cache instead
     of re-processing them, which is most of what a retry costs.
3. **Telemetry is suppressed for the owner's own testing.** `usage_events`
   shows edge-function calls on 2026-07-28; `telemetry_events` has nothing
   after 2026-07-23. The client was verified working in a browser harness the
   same day, so this is Do Not Track / Global Privacy Control doing exactly
   what it is supposed to. Do not read a quiet week as low usage — check
   `usage_events` first (query 0 in the SQL file).

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
  `prepareDemoPlanState` is the canonical reset.
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
- Edge functions live: `analyze-space`, `render-after`, `get-shared-space`,
  `track-events`. All verify_jwt (anon key passes); CORS allowlist in
  `_shared/cors.ts` (Pages, scmsolutions.org, tidymaps.ai, localhost:8000/8123).
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
  rather than reasoning about it (both bugs this session were confirmed by
  screenshotting pixels and reading the wire, and one of them looked like a
  model-quality problem right up until it didn't), and mock the edge functions
  with `page.route('**/functions/v1/...')` when the backend isn't reachable.
  A faked Supabase session in `localStorage` (see
  `tests/e2e/saved-space.spec.mjs`) makes the whole signed-in surface testable
  offline.

## Open items / next actions

1. **Confirm the AI path actually completes now** (Production health #2). One
   real analysis with photos, then read the edge logs: a 200 with a plausible
   elapsed time means the fix landed, `source: 'ai'` in telemetry confirms it
   end to end. Until someone runs that, "fixed" is a claim about the code, not
   about production.
2. **Live share-link round trip** (user to-do, still unverified): mint a link
   on a saved plan → open `?share=` signed out; expect banner + plan, no
   household or photos. Now unblocked — spaces finally exist to share.
3. **Get the funnel past the report.** Nobody has ever reached customize, save,
   or feedback (`docs/telemetry.md`). Until feedback is asked for somewhere on
   the results screen itself, the pay-for-it question cannot be answered no
   matter how long telemetry runs.
4. **#5 products:** SKU curation + real affiliate IDs (business), then flip the
   flags in `js/affiliates.js`.
5. **Media production (design-owned):** shoot the two landing photos; produce
   step clips against the SVG scene specs. Both ship by dropping a file and
   flipping a manifest entry to `ready` — CI guards the rest.
6. **A `space_saved` telemetry event** would let the fix above be measured
   rather than assumed; it needs an allowlist entry and a `track-events`
   redeploy (`docs/telemetry.md`, "Adding an event").

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history), open draft PRs, subscribe to PR
activity, and re-check open PRs on a timer until they merge.

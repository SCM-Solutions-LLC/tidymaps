# TidyMap engineering handoff

A durable snapshot of what shipped, how it fits together, what's deployed, and
what's still open — so a fresh session (or human) can continue without
re-deriving anything.

**Last refreshed:** 2026-08-19. Everything through PR #99 is merged; `main` is
the single source of truth.

**Correcting the previous refresh, because it was load-bearing and wrong.** The
2026-08-05 entry said to read the open items knowing that *"all four are waiting
on someone using the app, not on code."* That framing survived two weeks and it
cost real time. Two of the four were not waiting on traffic at all:

- **Plan generation was down.** The `ANTHROPIC_API_KEY` secret had expired.
  Every `analyze-space` call returned 502 `authentication_error: API key is
  invalid`, and the client fell back to a demo plan behind an honest banner. So
  the app looked like it worked, and the "quiet funnel" read as low usage.
- **The funnel was being written to by the test suite.** `node --test` posted
  real `space_saved` events to production (see Production health #4).

Neither was visible from the tables the old entry told you to check, and the
first was findable in one query against the edge logs. When something reads as
"nobody is using it", rule out "it is broken" and "we are lying to ourselves in
the data" before concluding anything about demand.

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
| 1 | Plan generation engine | ✅ shipped; **re-confirmed live 08-19** after the key expiry | #19 |
| 2 | Vision detection hardening | ✅ shipped | #20 |
| 3 | Imagery library pipeline | ✅ shipped; 5 keys, 1 photo pending, all photos now WebP | #20, #52, #53, #96 |
| 4 | Step-media pipeline | ✅ shipped; **134 clips rendered 08-10** | #21, #64–#79 |
| 5 | Products | ⏸ code done; blocked on business inputs | — |
| 6 | Persistence: share links + photo promise | ✅ shipped + deployed + **proven in production** | #23 |
| 7 | Automated QA | ✅ shipped; now lint + types + 504 unit + 183 e2e, all gating | #22, #90 |
| 8 | Telemetry + feedback loop | ✅ shipped; **pipeline fixed 08-19**, funnel still silent | #24, #98 |

### #1 Plan engine (PR #19)
`supabase/functions/analyze-space/index.ts` validates model output against a
zod schema (`_shared/planSchema.js`) with product invariants (categories only
from user selection, goal-driven steps never dropped, kid safety only when kids
present, effort caps, zero purchases on "use what I have"). One retry with
validation errors appended; second failure falls back to the deterministic
scenario engine. Fixture tests in `tests/`.

**What checkInvariants enforces, and what it deliberately does not.** The
household safety contract is machine-checked rather than requested: a flag
needs somebody to protect (kids, or pets for `lock-or-latch` — a cat reaches
any height, so a latch is the only barrier and rejecting it was wrong), every
flag needs a `safety.why`, chemical or sharp items may not sit within
`KID_REACH_IN` (48in) of the floor with a child aged `YOUNG_KID_MAX_AGE` (9)
or under unless the row is latched, and a `kid-frequent` item may not sit on a
row the plan itself calls locked or out of reach. `geometry.shelfCount` is
repaired to the map length rather than rejected. Product coherence is per
item now (one listed product used to buy silence for every other purchase in
the plan), and `productNeeds` must be empty when the user actually CHOSE "Use
what I have" — mirroring `shoppingTouched`, which the validator was ignoring.

Two rules are deliberately unenforced, and the reasons matter more than the
rules. **Daily-use items between 30 and 60in for a reach need**: the plan
carries no marker for "daily", so every version of the check has to guess, and
a guess that discards an 80-second analysis is worse than the gap. **Heavy and
fragile items low**: the prompt used to demand all four hazard flags stay above
48in with young kids, which is backwards for these two — a heavy bin injures a
child who pulls it DOWN, which is why this app's own scenarios say "Heavy bins
go low so kids pull them out safely". Enforcing the prompt as written would
have rejected 12 of the 16 deterministic scenarios and pushed plans toward the
placement that hurts somebody. The prompt now states the two rules separately
and says why they point in opposite directions.

### #2 Vision hardening (PR #20)
- The photo preview is hardened the same way, and later: `render-after` used to
  take `instructions` — 4000 characters of free text — and hand them to the
  image model verbatim. The client now sends `zones: [{level, zone}]` and the
  brief is composed in `_shared/renderBrief.js`, where the zone text is
  sanitized with the same `sanitizeUntrusted` and fenced behind its own guard.
  The upstream call has a 75s deadline (below the client's 90s, so the server's
  own answer is what the user reads) that cancels the request rather than
  abandoning it, and the returned image is checked for type, base64 shape and
  size BEFORE it is uploaded, pointed at, or sent to a phone.
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
- `track-events` edge function (live, v18) re-sanitizes every batch against
  `_shared/telemetryEvents.js`: 10-event allowlist, flat primitive props,
  80-char strings, 1KB/event, 25/batch. Client `js/telemetry.js`: random
  localStorage `anon_id`, debounce + flush-on-hide, honors DNT/GPC, fails
  silently.
- **It refuses to send from anything that is not a browser.** `optedOut()`
  checks `typeof document === 'undefined'` *before* `navigator.webdriver`,
  because the webdriver check catches Playwright and misses Node — and for a
  while `node --test` was posting real events to production (Production health
  #4). Anything that imports `js/db.js` outside a browser reaches `track()`.
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

## What shipped in PRs #54–#99 (2026-08-07 → 08-19)

Forty-five PRs across four working branches. Grouped by what they were for,
because the branch names do not tell you.

**The plan says only what it can support (08-07, 08-11).** A long run of
honesty fixes, most found by reading a real report rather than the code: the
prose and the headline time now agree; every goal the user picks is read, not
just the first that maps; the style cards and the pet answer are used rather
than collected; the household scrub rewrites kid phrases instead of deleting
them mid-sentence; and the report stopped describing rooms it never saw. Six
answers that the wizard collected and never sent now reach the model.

**Measurement and fit (08-07, 08-11).** Typed measurements survive re-confirms,
reloads and reopens. The measured space caps product fit on every axis. A
renter can say so, and their measurements stop being silently replaced. The
mobility answer moves things — and specifically does not move the things that
must not move.

**Step clips (08-10).** `remotion/` renders the step animations
programmatically from the `STEP_ART` spec: 13 choreographies, 134 clips, VP9
WebM per key. This moved the step-media slot from design-owned photo work to a
re-runnable build step. The inline SVGs stay as the permanent fallback for any
key outside the produced set.

**Accessibility (08-11).** axe-core runs inside Playwright and sweeps every
screen for WCAG 2 A/AA failures, so the contrast work cannot silently rot.

**The 3D viewer (08-13, 08-14, 08-19).** Ten sliders folded behind one
disclosure; the two columns balanced; organizers placed where the plan pays for
them, and addable — with the cost stated, because adding one is a purchase.
Most recently (#99) the viewer stopped calling one thing two things: the
controls said "Number of shelves" while the sidebar said "Zones" for the same
`row.shelfIndex`, and the scene's zone labels were built `visible=false` and
revealed only on hover — unreachable on a touch screen. Labels are now drawn by
default with a toggle, read place *and* purpose ("Top shelf · Bulk overflow"),
and are culled per frame when the camera is behind their wall.

**Edge functions deploy on merge (08-12).** Previously the site shipped on
every merge and the functions were whatever someone last pushed by hand — which
is how the `analyze-space` prompt sat seven days behind `main`. Now the same
merge publishes both. The workflow deliberately omits `--prune`, so deleting a
function is still a manual act.

**Legal and site paperwork (08-14).** The five legal documents completed,
Virginia named as the governing law.

**Plan identity and async ownership (08-15, 08-17, 08-18).** The largest
structural change of the period. Every plan carries an instance id, and every
asynchronous writer proves it still owns the plan before touching state — a
save, a load, a render, an analysis. This closed a family of bugs where plan A
finishing mid-flight would land on plan B: `activeSpaceId` stamped onto the
wrong row (so B's next save overwrote A), media uploaded into the wrong space,
and a photo preview rendered against another plan's instructions.

**Persistence (08-17, 08-18).** Incremental saves stopped being lost; shelf
index 0 stopped being treated as absent; malformed bodies are rejected with
`400 invalid_body` by a shared guard; the answers ride along on every
incremental write (`ANSWERS_VERSION = 2`); and a `keepalive` PATCH on
`visibilitychange`/`pagehide` stops the last write dying with the page.

**Site hygiene (08-18, PR #96).** Two measured bands of horizontal scroll
removed (the appbar needs 777px, and the hamburger breakpoint was 719px);
a custom `404.html`; the copyright year unfrozen; and the photographs re-encoded
as WebP — `assets/` went from **11MB to 1.9MB**, with the landing page's two
pictures dropping from 1.7MB to 172KB. Guards in `tests/images.test.mjs` now
reject a PNG in `assets/photos/` and enforce a per-image weight budget.

**The caller-IP question, settled by measurement (08-18).** A temporary
`debug-headers` function established what the edge actually does with forged
client-IP headers: Cloudflare **rejects** a request carrying `cf-connecting-ip`
(403 before the function runs), **strips** `x-real-ip`, and **overwrites**
`x-forwarded-for`. Identity did not move for any forged header — the rate limit
is not bypassable that way. `_shared/callerIp.js` was rewritten around the
measurement, and the probe, its secret and its config deleted afterwards.

**Types and lint (08-18).** `eslint.config.mjs` and a data-layer-scoped
`jsconfig.json` (`tsc --checkJs`) both run in CI ahead of the tests. The state
object has a declared `AppState` typedef. Worth knowing: of the 225 type errors
the first full run produced, **none was a bug** — about 90 were DOM narrowing —
which is why the config is scoped rather than repo-wide.

## Production health as of 2026-08-19

1. ~~Zero saved spaces~~ — fixed 07-28.
2. ~~`analyze-space` timing out~~ — fixed 07-30, and the timing has not
   regressed. `EFFORT` is explicit (`medium`), thinking is pinned off, and the
   handler is measured against `TOTAL_BUDGET_MS` (100s).
3. **The API key expired, and nothing noticed for days.** Between roughly
   2026-08-04 and 2026-08-19, every `analyze-space` call failed:

   ```
   analyze-space model call failed <id> upstream
   {"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}
   ```

   Five calls on 08-18 (three of them 28 seconds apart — a person pressing
   "Retry analysis" twice), all 502, all failing in 0.3–1.1s, far too fast to
   be a model call. **Replaced 2026-08-19 and confirmed working:** the `spaces`
   row created 16:17:55 carries
   `plan_meta = {"source":"ai","model":"claude-sonnet-4-6"}`, and the report
   named nine detected categories from a real photo.

   Three things worth keeping from this:
   - **The failure was invisible from the product side.** The client falls back
     to a demo plan built from the user's own answers, behind an honest banner
     ("We couldn't analyze your photos this time"). That is the right
     behaviour, and it is also why an outage can run for two weeks unnoticed.
     Nothing alerts on it.
   - **`usage_events` cannot tell you.** It is a rate-limit ledger — `fn`,
     `user_id`, `ip_hash`, `created_at` — with no status column. A failed call
     and a successful one look identical there. The edge logs are the only
     record of the outcome, and they retain **24 hours**.
   - The cheapest standing check is `plan_meta->>'source'` on recent `spaces`
     rows. `demo-fallback` where you expected `ai` means the model path is
     broken, and it survives longer than the logs do.
4. **The unit suite was posting telemetry to production.** `telemetry_events`
   held 68 `space_saved` rows with a null `anon_id` that no user created.
   `optedOut()` disabled telemetry under automation via `navigator.webdriver`,
   which catches Playwright but not Node — Node has had a global `navigator`
   since v21 without `webdriver` on it, so `node --test` read as a consenting
   browser. `tests/plan-instance.test.mjs` drives two successful inserts
   through `persistSpace()`, `js/db.js` reports a successful insert with
   `track()`, and the batch left four seconds later.

   Fixed in #98 (`typeof document === 'undefined'` → opted out), and the 68
   rows deleted. `anon_id` is the column the funnel joins on, so the junk was
   both louder than the real data and unjoinable to it.

   **Verify a claim like this at the socket, not the flag.** The regression
   test spies on `fetch` rather than stubbing it: a stub answering 200 lets the
   test pass while the request still leaves the machine.
5. **The numbers are a smoke test, not a trend.** As of 2026-08-19: 1 user,
   1 saved space, 1 feedback row, 142 usage events, and 103 telemetry rows —
   of which 99 are real and **4 are the same junk, created after the cleanup
   and before #98 reached `main`** (two from PR #99's CI at 18:35, two from the
   `main` deploy run at 19:56, both on code predating the fix). They are safe
   to delete with the same predicate:

   ```sql
   delete from telemetry_events where name = 'space_saved' and anon_id is null;
   ```

   Direct evidence the fix holds: #98's own unit job ran at 20:21 **with** the
   fix and produced no row.
6. **`analyze-space` has been called 22 times ever**, last 2026-08-19 16:16:56.
   `render-after` has been called 4 times ever and remains the least-exercised
   path in production; its `GOOGLE_AI_API_KEY` has **not** been checked since
   the Anthropic key expired, and the same silent-expiry failure mode applies.
7. **Telemetry from the owner's own browser may be suppressed.** Do Not Track
   and Global Privacy Control both switch it off (Brave, DuckDuckGo and Firefox
   send GPC by default), and `telemetryStatus()` on `window` says which in one
   line. Check `usage_events` before reading a quiet week as low usage — but
   read #3 above first, because "broken" and "unused" look the same from here.

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
  0007 atomic_usage_and_storage, then three timestamped ones —
  `20260728231041 add_analysis_diagnostics`,
  `20260728232808 drop_analysis_diagnostics` (added and removed the same
  evening), and `20260729185333 form_submissions_via_function`.
- Edge functions live, versions as of 2026-08-19: `analyze-space` v31,
  `render-after` v25, `get-shared-space` v18, `track-events` v18,
  `submit-form` v15. All `verify_jwt: false` — they check JWTs themselves so
  guests can call them. CORS allowlist in `_shared/cors.ts` (Pages,
  scmsolutions.org, tidymaps.ai, localhost:8000/8123). **Note 3000 is not on
  that list**, so a local dev server on that port gets a preflight failure and
  telemetry silently never sends.
- **Production matches `main` automatically now.** Since 2026-08-12 the same
  merge that publishes the site publishes the functions
  (`.github/workflows/deploy-functions.yml`, requires a `SUPABASE_ACCESS_TOKEN`
  repo secret). The old advice to deploy by hand and read the function back is
  obsolete for the normal path — but the workflow deliberately omits
  `--prune`, so **deleting** a function is still a manual `supabase functions
  delete`.
- Secrets live on the project, not in the repo (`supabase secrets list` prints
  digests, never values): `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`,
  `IP_HASH_SALT`, plus the Supabase-managed ones. `js/config.js` holds only the
  project URL and the anon key, both public by design.
  - **These expire silently.** See Production health #3. Nothing in the repo or
    in CI can detect an expired key, because CI cannot reach the real API and
    the function returns the same 502 shape for any upstream failure.
- Note the two entrypoint layouts, which are not interchangeable:
  `analyze-space` and `render-after` deploy under `supabase/functions/...`,
  while `get-shared-space`, `track-events`, and `submit-form` deploy under
  `functions/...`. Bundle `_shared/*` and `import_map.json` at the matching
  depth or the imports do not resolve.
- For manual deploys and SQL, use the Supabase MCP tools. The CCR sandbox's
  network policy blocks direct HTTPS to `supabase.co` — use MCP, not curl, and
  don't mistake that 403 for an outage.
- **Edge logs retain 24 hours**, and `query_logs` caps a request at a 24-hour
  window. Anything you want to know about a production failure older than that
  has to come out of the database instead.

## Testing & verification

- `npm install` first — `zod` is a runtime dependency of the shared plan
  schema, and two unit files fail with `ERR_MODULE_NOT_FOUND` without it.
- **Four gates, all of them in CI on every PR** (`.github/workflows/test.yml`):
  `npm run lint` (ESLint 9 flat config), `npm run check:types`
  (`tsc --checkJs` over a scoped `jsconfig.json`), `npm test` (**504 tests**
  across 41 files), and `npx playwright test` (**183 tests** across 38 files).
  Pages deploy and the edge-function deploy both run on push to `main`.
- In this sandbox the Playwright-managed browser isn't installed; run with
  `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- Mock the edge functions with `page.route('**/functions/v1/...')` when the
  backend isn't reachable. A faked Supabase session in `localStorage` (see
  `tests/e2e/saved-space.spec.mjs`) makes the whole signed-in surface testable
  offline. Note only three specs install a **host-wide** catch-all; the rest
  stub one function path each.
- Browser smoke-test every user-facing change rather than reasoning about it.
  Repeated sessions have found bugs this way that no unit test would catch: a
  feedback screen asking a question already answered, a share view claiming two
  adults, an appbar overflowing at 768px.

### Prove a new test fails without its fix

This is the single most valuable habit in this repo, and the reason is that
**writing a test that cannot fail is easy and feels identical to writing a good
one.** Real examples from these sessions, all of which passed against unfixed
code:

- a canvas test using a 3-byte fake PNG that never decoded, so `img.onerror`
  fired before the canvas was ever touched
- a focus-trap test asserting "focus stayed in the modal" — `.focus()` on a
  `display:none` element silently does nothing, so "didn't move" looked
  identical to "stayed"
- a zone-label test asserting "visibility did not change" when nothing was
  visible to begin with
- a telemetry test asserting that a `fetch` **stub** was called, which would
  pass while the request still left the machine. Assert at the socket: spy,
  don't stub, and require the sent list to be empty.
- a `check:types` run "verified" with `grep '^js/'`, which hid ~180 vendor
  errors and a non-zero exit

Verify by stashing the fix (`git stash push <files>`), running, and restoring.
**Do not use `git checkout <file>`** — it reverts every change in that file,
not the one line you edited.

## Closed since the last refresh

- ~~Confirm the AI path completes~~ — settled twice over. Confirmed from stored
  `plan_meta` on 2026-08-05, and again on 2026-08-19 after the key replacement.
- ~~Live share-link round trip~~ — closed over the wire 2026-08-04. Three
  `shared_plan_viewed` rows under three distinct `anon_id`s, an hour apart, plus
  `get-shared-space` 404s after the link was revoked, exercising that path too.
- ~~Watch the first live analysis after 2026-08-04~~ — done, and the answer was
  that the analyses were **failing**, not merely unobserved. See Production
  health #3. The v16 step caps have now run for real; the steps on the
  2026-08-19 report are within the 8-word cap, so the cap does not need to move
  into `checkInvariants` yet.
- ~~Edge functions deployed by hand~~ — automated 2026-08-12.
- ~~Step clips pending~~ — 134 rendered 2026-08-10.
- ~~Media production, one remaining slot~~ — `hero-home` still has a working
  declarative `src`, and the photographs are now WebP. Nothing on the site is
  broken for want of art.

## Open items / next actions

Ordered by whether anyone can act on them today.

### Actionable now

1. **Delete the last 4 junk telemetry rows.** They arrived after the cleanup
   and before #98 reached `main`. One statement, in Production health #5.
2. **Check `GOOGLE_AI_API_KEY` has not expired too.** `render-after` has been
   called 4 times ever and not at all since the Anthropic key died, so nobody
   would know. The cheapest test is to generate a photo preview from a report
   and watch for a 502 in the edge logs within the retention window.
3. **Nothing alerts on a broken model path.** The outage in Production health
   #3 ran for around two weeks behind a graceful fallback. A daily check of
   `plan_meta->>'source'` on the newest `spaces` row — or of the
   `analyze-space` error rate while the logs still hold it — would have caught
   it on day one. This is the highest-value piece of unbuilt work in the repo.
4. **The AI photo preview may be undiscoverable.** Reported as missing from the
   report. The button lives in `#after-photo`, which `setupAfterPhoto()`
   (`js/screens/results.js:302`) unhides whenever a photo is in memory — but
   its chapter `#ch-after` ships `class="chapter collapsed"` under the heading
   "What it could look like", while the TOC calls it "Before & after". Unproven
   either way; settle it in a browser on a report with a photo:

   ```js
   [document.getElementById('after-photo').className,
    document.getElementById('after-gen-row').className]
   ```

   Neither containing `hide` → it is present and merely folded, and the fix is
   discoverability. `after-photo` containing `hide` → the photo left memory,
   which is a different and worse bug.
5. **Step-length caps are unvalidated server-side.** `planSchema.js` checks step
   *count* (line ~272) and nothing about length, so a model that ignores the
   8-word cap ships a plan that passes validation and renders long. It behaved
   on the 08-19 run; if it stops, the cap needs to move into `checkInvariants`,
   where a violation costs a retry instead of shipping.

### Waiting on traffic

6. **The funnel still has nothing to say.** `plan_rated` and
   `feedback_submitted` have never had a row. `plan_created` last fired
   2026-07-30 — and note the 2026-08-19 session produced a plan and *still* no
   `plan_created`, which is not yet explained. Do Not Track / GPC is the
   leading candidate (`telemetryStatus()` on `window` reports it in one line),
   but rule out the CORS origin too: only the hosts in `_shared/cors.ts` can
   post, and `localhost:3000` is not among them. Read `plan_rated` before
   `feedback_submitted` — the first is one tap on the report, the second needs
   three more screens.

### Waiting on business input

7. **#5 products:** SKU curation and real affiliate IDs, then flip the flags in
   `js/affiliates.js`. Every entry is still an empty string, so all 30 catalog
   products link plain and no disclosure renders.

### Known gap, no owner

8. **`docs/HANDOFF.md` went 14 days and 45 PRs stale**, and its headline
   framing actively misled (see the correction at the top). If you are reading
   this more than a few merges after the refresh date, distrust the specifics
   and re-derive from `git log` and the tables before acting on them.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history), open draft PRs, subscribe to PR
activity, and re-check open PRs on a timer until they merge.

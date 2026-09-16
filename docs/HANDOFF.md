# TidyMap engineering handoff

A durable snapshot of what shipped, how it fits together, what's deployed, and
what's still open — so a fresh session (or human) can continue without
re-deriving anything.

**Last refreshed:** 2026-09-15, after PR #170 merged: batch 3 of open item 12
(performance, infrastructure, backend) is closed. #169 declared
`contents: read` on the three CI workflows that don't write through
`GITHUB_TOKEN` (pinning actions to SHAs and the OTP/captcha check
resolved themselves — see the open-items entry). #170 unified
`theme-color` and added `color-scheme`/`robots.txt`/`sitemap.xml`,
corrected the hero image's aspect ratio, and fixed the README's live-site
URL to match the canonical. Earlier in batch 3: #159 split the feedback rating
question into usefulness and willingness-to-pay. #160 builds a deploy-only
`_site/` for Pages instead of uploading the whole checkout. #161 inlines the
two critical stylesheets and async-loads the rest. #162 defers the two screen
modules (`viewer3d.js`, `products.js`) nothing else on the boot path reaches.
#163 renders the 3D view on demand instead of every animation frame forever
(a `let` TDZ bug and a pre-existing async-save race in
`three-editor.spec.mjs` were both found and fixed along the way). #164 drops
the italic webfont in favor of browser synthesis. #165 caps edge function
body size before parsing, exempts signed-in callers from the anonymous-only
global rate-limit breaker, strips EXIF/GPS from uploaded photos, stops
forwarding the upstream model's raw error text to clients, allowlists
`plan_meta` in share payloads, and makes `escapeHtml` also escape `'`
(removing `products.js`'s duplicate escaper). #167 adds a retention purge for
`usage_events` (30 days) and `telemetry_events` (180 days) via `pg_cron`, and
stops `render-after` from persisting its output to storage until the space
already has an explicitly-saved photo — closing a gap against the privacy
page's own promise. #168 wraps `auth.uid()` in five RLS policies and indexes
three previously-unindexed `user_id` foreign keys; the other two advisor
findings this batch set out to fix (the `handle_new_user` EXECUTE grant,
`pg_net` in `public`) turned out to already be deliberate non-fixes on record
in `0009_touch_updated_at_search_path.sql`, so they were left alone rather
than redone. Batch 3.5 (a lazy thunk map for the 14 layout builders) was also
evaluated and deliberately left alone: see the open items list below for why.
**That closes batch 3 of open item 12** (#159 through #170). A handful
of items inside 3.10/3.11 were deliberately deferred rather than done blind —
they are explained inline at their own open-items entries below.

Before that, PR #158 merged (`main` at `92e2f5d`):
the toast sits over the running head, the step clip band is capped at the
clip's width, the landing gallery lost a dead grouped-picker rule, and the
brand link goes home. Pages run 162 went green. **That closes batch 2 of
open item 12** (#147 through #158, all client-only, so the dead deploy
token — Production health #5, open item 11 — applied to none of them).
Before it, #157 (a signed-in plan that is not being saved says so once,
`sessionExpired`/`warnSaveFailed` in `js/db.js`, and the guest reload toast
names the photos it lost), #156 (the ten pure copy items), #155 (the space
cards as a `radiogroup` with a roving Tab stop), #154 (the rating buttons'
`aria-pressed` and the shelf list's `role=list`), #153 (the 3D drawing as
a focusable `role=application` widget the arrow keys rearrange), #152 (an
h1 on every screen and a skip link on every page), #151 (the small tap
targets are 44px without growing), #150 (the 3D view's sliders are 44px
targets in the row they had), #149 (the phone menu behaves like the
dialog it looks like), #148 (the progress rail stays full once the wizard
is complete) and #147 (the shelf map tints the eye-level shelf with the
accent).

**This session first closed the one piece batch 2 left behind: the
rating-scale split.** `js/data.js`'s `FB_USEFUL` used to carry "I would
pay for this" as a fourth point on a usefulness scale, so someone who
liked the plan enough to pay for it was recorded as a *different degree of
usefulness* than someone who merely thought it was very useful — one
question's answer options were actually answering two questions.
`FB_USEFUL` is three options now (not/somewhat/very useful) and a new
`FB_PAY` ('No'/'Maybe'/'Yes, I would pay for this') is its own question,
"Would you pay for this?", rendered right after usefulness on both
surfaces (the inline ask's `#rate-pay` and the dedicated screen's
`#fb-pay`). It answers with the rest of the form rather than at the
tap-and-count moment usefulness does — the same timing `vs` and `nextSpace`
already had, so no new abandonment risk was introduced. `state.fbPay`
joins `fbUseful` in the reset, the same-space carry-over, and the draft;
`feedback.pay` is a new column (migration `0010_feedback_pay.sql`) and
`submit-form` writes it. The telemetry side needed no new event and no
redeploy: `feedback_submitted`'s prop set is not schema-checked per event
name (`telemetryEvents.js sanitizeEvent` validates prop shape generically),
so adding `pay` to its payload is a client-only change; only the comments
describing both events were stale and are corrected. `submit-form.ts` and
the migration do touch `supabase/`, so per the merged-not-deployed rule
(Production health #5, open item 11) the column exists in the deployed
schema only once someone applies the migration by hand, and the function
change ships only once the deploy token is replaced (open item 11); until
then rows write `pay: null` in production even after this merges. The new
assertion (`tests/feedback-ask.test.mjs`, "usefulness and willingness to
pay are separate questions") was proven red by neutering only the
`FB_USEFUL` split, with a copied `js/data.js` restored from the copy
afterwards, never `git checkout`. Browser-checked at 390 and 1280 on both
surfaces.

The rating-scale split merged as **#159** (`main` at `87b2ef9`). **Batch 3
(performance, infrastructure, backend) is under way**: the Pages artifact
merged as **#160** (`main` at `7268c99`), inlining the two critical
stylesheets as **#161** (`main` at `9c7a56f`), the eager-JS line (only
partly closeable from `main.js` as it turned out) as **#162** (`main` at
`c21d39b`), the 3D render loop (which also carried a fix for a merge-time
regression in #162's own async click handlers) as **#163** (`main` at
`55e4b9e`). The layout-builders thunk map was measured and deliberately
not done (see its batch line below for why); the italic font is PR #164
(see the batch list below for all of them). Each PR this session was
cherry-picked from a local branch onto the one PR branch, reset from
`main` after each merge; the five cross-line
conflicts met along the way were resolved once on a scratch stack and the
full suite run against it (282 passed, 1 pre-existing skip) before any of
them went up.
Before that, 2026-09-15, after PR #145 merged (`main` at `aef98a6`,
12:44 UTC). **Batch 1 of open item 12 is done.** Four PRs this session, all
client-only, so the dead deploy token (Production health #5, open item 11)
applied to none of them: #142 (the sign-in modal explains a failed request
instead of printing the browser's fetch text; Pages run 147 green 10:02
UTC), #143 (a rate-limited analysis says how long to wait and is not
called a failure, `waitText` and `analysisFailureCopy` in `js/api.js`, the
code and wait carried as `state.aiFailure`; Pages run 148 green 12:14 UTC),
#144 (the security page's three false claims rewritten to what the code
does, with the privacy policy's copy of the salt sentence; Pages run 149
green 12:38 UTC, so **the corrected security page is live**), and #145
(the legal pages: photos not video, Resend named, all ten telemetry events
disclosed, the terms carry the share-redaction sentence and today's date;
Pages run 150 was in progress at the time of writing). Every new test was
proven red by neutering only its own behaviour, and every user-facing
change was browser-checked at 390 and 1280. **Batch 2 is under way** (UX,
accessibility, copy): its first line, the shelf-map tint, is PR #147, open
(draft) at the time of writing, and this header refresh (PR #146) was
folded into it rather than merged on its own. Left alone on purpose: the
"Last reviewed" dates on `cookies.html` and `accessibility.html` (nobody
reviewed them), and the copy-conventions test's blind spot for `&mdash;`
in JS (batch 2; the one instance in `loading.js` is gone).
Before that, 2026-09-15, after PR #142 merged (`main` at `52145ce`,
09:47 UTC): the sign-in modal explains a failed request instead of printing
the browser's fetch text. `js/auth.js` runs the library load and the request
under one catch and reads the error by name, status and code
(`authErrorMessage`), so no answer is "Could not reach the sign-in service",
a 5xx is "Sign-in is temporarily unavailable", 429 is "Too many attempts",
and a refused address on send is about the address rather than a code that
never went. Client-only, so the dead deploy token (Production health #5,
open item 11) does not apply. Pages run 147 went green at 10:02 UTC, so
**the sign-in modal's failure copy is live on the site.** That closes the
fifth line of open item 12's batch 1, with three lines left there
(rate-limit copy, `security.html`, legal pages); the rate-limit line is
PR #143, open at the time of writing.
Before that, 2026-09-15, after PR #140 merged (`main` at `5c8ca2c`,
05:16 UTC): the report says "Analyzed by Claude" once. The badge is the credit
and carries the model ("Analyzed by Claude · Sonnet 4.6"); the byline says the
basis in the same shape as its other readings ("Personalized plan · based on
your photos and selections"), and it has a share reading now ("Shared plan ·
based on the owner's photos", or "answers"), because "your photos" in the
byline would otherwise have printed to a visitor who took none, the claim #138
removed from the 3D view. Client-only, so the dead deploy token (Production
health #5, open item 11) does not apply. Pages run 145 went green at 05:30 UTC,
so **the report's single credit and its share byline are live on the site.**
That closes the fourth line of open item 12's batch 1, with four lines left
there.
Before that, 2026-09-15, after PR #138 merged (`main` at `c1ccb85`,
04:08 UTC): the 3D view stops claiming photos and the visitor's own space on
plans that had neither. One rule in `js/planProvenance.js` (`planFromPhotos`,
`planIsSample`, `answeredAnything`) answers whose plan it is for the report's
byline and the viewer alike, keyed on `planMeta.source` rather than
`uploadedFiles`; the viewer's heading, intro and status line read four ways
(sample, wizard without photos, photos, share view), and the share view was
the one place "matched from your photos" could actually print. Client-only, so
the dead deploy token (Production health #5, open item 11) does not apply.
Pages run 143 went green at 04:23 UTC, so **the viewer's provenance copy is
live on the site.** That closes the third line of open item 12's batch 1,
with five lines left there.
Before that, 2026-09-15, after PR #136 merged (`main` at `7fd9bca`,
01:25 UTC): the wizard's space step no longer passes the pantry placeholder as
the user's answer. `spaceTouched` joins the touched flags in `js/state.js`, the
space cards arrive unticked with Continue off until a pick, Review labels Room
and Spot as ours when untouched, and the report's `answeredAnything` counts the
pick. Client-only, so the dead deploy token (Production health #5, open item
11) does not apply to it. Pages run 141 went green at 01:39 UTC, so **the
space-step gate is live on the site.** That closes the second line of open
item 12's batch 1, with six lines left there.
Before that, 2026-09-14, after PR #134 merged (`main` at `14858ed`): the
stored XSS through the plan's icon fields is closed. Icons are keys into the
SVG table and the report's two icon sinks are table lookups, so nothing a
`spaces` row carries reaches `innerHTML` (see Production health #4 for why
that mattered: the share payload carried the row's markup verbatim). **The
deploy split on this merge.** Pages run 139 carries the client half, which is
the whole of the fix, and it went green at 22:16 UTC: **the XSS fix is
live on the site.** The server half (string caps in `planSchema.js` and the
matching enforced-limits line in `analyze-space`) did **not** ship: "Deploy
edge functions" run 21 failed with `401 Unauthorized` from Supabase, and run 20,
the weekly one at 12:43 UTC the same morning, had already failed the same way
on the previous `main`. The `SUPABASE_ACCESS_TOKEN` secret is dead. Production
functions are still what run 19 deployed on 09-07 (`main` at `c26eac3`), and
nothing under `supabase/functions/` changed between then and #134, so the live
functions equal `main`'s minus #134's caps. See Production health #5 and open
item 11. Before that, 2026-09-09, after PR #132 merged (`main` at `40b874e`): the 143
step clips re-rendered in the site's own palette, the correcting CSS filter
gone. That closes the last open design item from the redesign. Earlier the
same day, PR #130 merged (`main` at `9296f3f`): the
warmer cut of the one-accent redesign, with every drawing printed in its own
softer line (`--draw`) rather than the type ink. That is what the live site
shows. Before it, PR #128 (`5480b5b`, 03:43 UTC) landed the one-accent cut,
Archivo alone on a terracotta accent. PR #127 (`65ff9cb`, 09-08 19:48 UTC)
merged the linen cut and the elevation drawings for every space, setup and
product card; PR #128 carries the three commits that followed it on the same
branch and missed the merge, the same way #124's follow-ups had. PR #124
(`02736ba`, 09-08 03:47 UTC) was the first cut of the redesign. Before that,
2026-09-08 after PR #125 (`9de99b6`), and 2026-09-04 after PR #120
(`7619fb8`). Everything
through PR #115 is merged (`main` at `0bec7a0`) and **deployed** — Pages run 120 went green on 08-21, so the four
viewer ports below are live on the site, not merely landed. `main` is the single
source of truth.

**Nothing shipped between 08-21 and 08-27.** That week was a memory-and-health
review, not a build: the repo was already green, and what it turned up was two
signals nobody was watching. Both are in "Production health" below, and both
sharpen open items rather than adding new ones. The one code change from it is
the step-length cap (open item 4), plus this repo's first `CLAUDE.md`.

**The other memory stores about this project are all stale.** An Obsidian vault
(mirrored to Dropbox, and one-way into a Notion "Vault Mirror" database) and
several standalone Notion pages describe TidyMap. As of 2026-08-27 every one of
them predated this architecture — the vault's own venture page still called the
product a BYOK single-file prototype on `scmsolutions.org/tidymap.html`, six
weeks and a hundred PRs after that stopped being true. They were refreshed on
08-27 to point here. Treat this file as the only current memory: the others are
snapshots, and a snapshot of a fast-moving repo ages into a lie.

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

## What the 2026-09-08 session changed (open item 10: 33 setups, one 3D view each)

**The measurement first, because the item's own number was a proxy.** Item
10 said 26 of 33 setups overfilled their geometry, measured by building each
setup's demo scenario the way `three-setup-matrix.spec.mjs` does: scenario
geometry, no dims, needs with their `maxDims`. That is not what a visitor
sees. The wizard seeds `state.dims` from `SETUP_DIMS` for every setup, the
shopping list swaps each need for a catalog product with real dimensions,
and the fit note only shows when `state.upgrades` is on (the default when
the shopping step is left alone). Walking the real wizard for all 33 setups
with the defaults and no backend, at `c26eac3`: **25 of 33 opened the 3D
view with the fit note showing.** After this session: **0 of 33.** The walk
is now `tests/e2e/demo-fit.spec.mjs` (one test per space, nine in all), and
it is the only guard that measures the thing the item was about.

**Six causes, none of them the visitor's.** In the order they were found:

1. **A partial match claimed a need before the row it named was reached.**
   `targetScore("Below the bench", "Bench drawers")` is 1 on the word
   bench, that row comes first, and rows are offered needs in order, so the
   workbench's floor bins were filed in a drawer and then reported as not
   fitting it. The 09-03 change stopped generic words from counting; this
   one takes each need's best possible score up front (`bestScoreByNeed` in
   `buildScene`) and only offers a row a need it scores that well for.
2. **The projection aligner relocated by shared words, generic ones
   included.** `alignTargetZones` scored "Middle shelf" one point against
   "Upper cabinet: top shelf" on the word shelf, so the pantry's 14-inch can
   rack went to the butler's 7-inch top shelf on every projected setup. It
   now keeps the *kind* of level (`levelRole()` reads rod, door, drawer,
   bay, deck, surface, floor, high, reach, mid, low off a name; projected
   rows carry the template's `role`), walks a ladder when the kind is
   missing (a height falls through, a drawer clamps to the last drawer),
   and matches ordinals among same-role peers so the garage rack's second
   high shelf lands at a wall cabinet's eye level rather than in the sliver
   over its top board. Word overlap, minus the generic words, is the
   fallback, and the eye zone the last resort. `projectOntoArchetype` passes
   the source rows in so the ordinal is known.
3. **Builders reported drawing conventions as physical dimensions.** A
   drawer's `depth` was the distance it is drawn pulled out (0.6 of the
   carcass), so a 12.9-inch tray in an 18-inch dresser "did not fit" 10.8
   inches; its `gap` was the pitch less a rail less a margin, and the fit
   verdict took 1.4 more off, so a 1.9-inch tray failed a 4.3-inch top
   drawer. Under-bed bays used stacked-shelf gaps though they sit side by
   side; the overhead rack's deck had three inches of headroom under a
   ceiling eighteen inches up. Drawer surfaces now publish `clearance`
   (the box's inside height) and `depth` (the carcass less back and front);
   the garage rack's top shelf and the top wall shelf say `openAbove`; the
   overhead deck's gap is the measured drop. `reflow` keeps the visual
   `maxH` (items still sit with air under the next board) and judges fit
   against the clearance.
4. **Regenerated shelf spacing made every top compartment a sliver.**
   `evenShelfFracs` ran 0.08 to 0.90: the top board eight percent of the
   height below the top, the rest shared. A 30-inch wall cabinet drawn with
   three shelves got a 3.2-inch top compartment (the `H-T-3.2` clamp in
   `buildScene` is exactly that minimum); a sideboard drawn as two drawers
   got a 3-inch drawer over a 31-inch one. Eighteen of the 33 setups are
   projected and take this spacing. It is now `0.92 * (i+1) / n`: n
   compartments of one height with the bottom board on the floor. Scenario
   authors' own fractions are untouched, so the sample pantry looks exactly
   as it did on 09-04; the three copies of the old formula (viewerOptions,
   plan.js, scene.js) are one function now.
5. **Racks were counted as leftovers.** A hook rack on a closet door, in a
   layout that draws no door, was "1 organizer from your list has no spot in
   this view yet. The levels they were meant for are full. Add a level
   above", which is not where a hook rack goes. `isMountedOrganizer` types
   with no accepting surface in the scene go to `view.mountedElsewhere` and
   the panel says "Not drawn: a hook rack. It mounts on a door or wall,
   outside this view." (`#v3d-mounted-note`). A rack the scene *could* hang
   but has no room for is still a leftover.
6. **Three scenarios asked for the impossible, and every scenario was one
   size.** The drawers scenario wanted three 22-inch trays in one top
   drawer of a 24-inch bank (now one per drawer: `targetZone: 'Every
   drawer'`); the closet's top shelf was 8 percent of the height with
   12-inch baskets on it (fractions now `[0.16, 0.40, 0.60, 0.90]`, which
   also gives the two rods a double-hang); the bathroom's drawers had a
   3.2-inch pitch and a 26-inch tray (`[0.20, 0.42, 0.64, 0.88]`, tray 18).
   And a need carries the size its scenario had room for: an 18-inch tower
   was told to buy the 22-inch tray, and a 9-inch wall shelf a 10-inch
   turntable. `fitNeedsToSpace()` caps `maxDims` depth at the measured depth
   less 2 and width at the measured width less 3.5 (the builders' usable
   width), projected or not; racks are exempt, as in `catalog.js`. The
   catalog's `fitFor` takes the same 3.5 off the measured width, so the
   report and the view stop disagreeing about a 16-inch tray in a 14.5-inch
   drawer.

**The second pass the item suggested is in.** After every row has had its
say, whatever a need still owes is offered to every other row whose surface
can carry it, best-scoring row first, and only where the product's own
height and depth clear that row. An item carrying a vocabulary-implied
organizer (every drawer item is drawn with a divider; every pantry item with
a basket once the plan says "reuse your baskets") gives it up to a purchase.
What no row can take stays owed and the warning still counts it, so the note
is as true as before and appears only when it is.

**Two things this did not do, on purpose.**

- The walk-in and L-run shelf depth floor went from 8 to 14 inches in any
  room at least 28 inches across (a 4-foot linen closet had 9.6-inch
  shelving no basket in the catalog fits; 14 is the shallowest closet shelf
  sold and leaves a 20-inch aisle there). A shallower room keeps the old
  proportion, capped at half its smaller dimension, because CI caught a
  12-inch-deep L-run drawing 14-inch shelves outside its own footprint
  (`three-setup-matrix.spec.mjs`, the scenario geometry with no dims). The
  72-inch walk-in that `organizer-depth-fit.spec.mjs` measures is unchanged
  at 14.4.
- Scenario-authored shelf fractions that start at 0.08 (the pantry, the
  garage, the linen closet) still draw a short top compartment: 5.5 to 7
  inches on their default heights. Nothing tall targets those shelves any
  more, so they pass, but a future author who puts a 12-inch bin on a
  "Top shelf" in one of those scenarios will see the note again. The
  `H-T-3.2` clamp and the 0.08 convention are the same decision seen from
  two sides; changing it changes the sample pantry every visitor sees and
  the "Set exact sizes" readouts (`shelfHeightInches` does not apply the
  clamp), which is a session of its own.

**How the tests were checked.** Each new test was run against its own
behaviour disabled, per the rule below: the role ladder off (unit test red;
the garage matrix test stays green because the second pass and the new
spacing cover that space on their own, so the ladder's guard is the unit
test, not the walk), the old spacing formula (red), the second pass skipped
(red on "Expected 0, received 2"), the drawer depth back to the pull-out
(red). The nine matrix tests were seen red at `c26eac3` in the measurement
above, 25 of 33, using the same walk. One caution about the matrix: it
walks the wizard 33 times and takes about four minutes across two workers,
the longest thing in the e2e suite.

**One mistake worth recording.** Mid-session, `git checkout
js/setupStructure.js` was run to undo a one-line neuter and reverted every
change in the file, exactly as the rule under "Prove a new test fails
without its fix" says it will. The edits were re-applied from the session
transcript and the file diffed against its backup. Copy the file before a
neuter; never checkout.
## What the 2026-09-07 session changed (whole-site visual redesign)

The owner opened the incumbent look (cream stock, serif display, terracotta
accent) to replacement, with copy and flow free to change and only the backend
untouched. The redesign ran the Impeccable flow: `PRODUCT.md` records product
truth (interviewed 09-07), `.impeccable/surfaces/index-html.md` holds the
direction contract, and `DESIGN.md` plus `.impeccable/design.json` were written
from the shipped build afterwards. Read those three before touching any CSS.

**The world is The Home-Economics Manual** (re-inked twice on 2026-09-08,
last under a tasteskill v2 audit the owner ran): white stock, off-black ink,
warm-grey content fields, and one terracotta accent (`--spot`, under 80%
saturation, the old brand hue) carrying every button, selected state,
progress mark and figure label. No gradients, no shadows, square corners, 1px
rules. Archivo (wdth axis, self-hosted) sets everything; the display serif
and the reading serif of the earlier cuts are gone, as are the stone band,
the brass rule and the chapter numeral. The landing hero is a split: headline
and actions left, Figure 1 right with its legend beneath.

- **Landing**: split hero, then **Figure 1** as the hero's picture: an inked
  pantry elevation whose thirty items slide from a jumble into four labeled
  zones once the figure is on screen (`js/screens/landing.js initFigure`;
  reduced motion draws the finished figure). The plan's reasons are a legend
  under the drawing at every width. "What you get" is a two-column zig-zag.
  The photo hero is gone and its pending manifest slot (`hero-home`) with it.
- **Kickers are gone everywhere** (`.wiz-badge`, `.plan-badge`, `.v3d-badge`,
  the loading eyebrow, the dashboard kicker). Headings carry their own weight.
- **Report**: the plan hero is now the plan's own cupboard drawn as an
  elevation (`results.js planElevationSvg`, one shelf per map level, zone
  printed on the shelf); the four figures are a ruled table row; each step's
  numeral is printed inside its square mark. The produced step clips are
  re-rendered in the site's own palette (`remotion/src/tokens.ts` mirrors
  `css/tokens.css`: warm stone field, the drawings' line, terracotta accent),
  so the grayscale/contrast/multiply filter that used to correct them is gone.
  A palette change in tokens.css means updating tokens.ts and running
  `node render-steps.mjs --force` from `remotion/` (about 25 minutes; the
  script pins Remotion to port 3939 because 3000 is usually held).
- **The nine space cards are redrawn as elevations** (`js/wizard-data.js`
  `EL_ART` / `EL_MOTION`, keys `el*`), in Figure 1's voice: one thin ink
  line, square corners, stock and tint fills, a short spot rule for a label,
  and a moving object drawn the same way. The 28 setup-card drawings on step
  2 (`SETUP_ART` / `SETUP_MOTION`, same keys the tests bind) are redrawn in
  the same voice, with walk-ins and L-shapes carrying angled return walls.
  `js/product-art.js` (product library and shopping-list glyphs) is redrawn
  the same way, so every drawing on the site is now in one voice.
- Tests moved with the design: `tests/design.test.mjs` now binds the plate,
  the two self-hosted faces, and Figure 1's sort; the mobile menu rows are
  48px; the report appbar actions fall back to icons at 519px because the caps
  labels are wider.

All four gates were green at the end of the session (lint on tracked sources,
types, 532 node tests, 213 e2e including the axe scans). Nothing was deployed;
this landed as a draft PR from `claude/home-economics-manual-redesign`.

## What the 2026-09-04 session verified (PR #120 in a browser)

PR #120 merged at `7619fb8` and Pages run 125 went green at 00:59 UTC, e2e
step included. The production domain is not reachable from the sandbox (the
proxy refuses the CONNECT), so the verification below ran against a local
serve of the same commit in the sandbox's Chromium 1194, at 390px and 1280px,
with the edge functions routed to abort so nothing left the browser. The
screenshots live in the session scratchpad, not the repo.

**The eleven-step wizard holds.** Landing to review is eleven Continue
presses; every screen's label reads `Step N of 11` in order, `#flow-ctx`
accumulates room, spot, setup and size as the steps go by, the review screen
lists Room and Spot as two rows whose Edit buttons both go to the space step,
and Build lands on the loading screen and then the results screen with no
page error and no console error at either width. With no photo the analysis
is never called (no request reached the `functions/v1` route), so the plan is
the built-in pantry plan, which is what a visitor without a backend sees.

**Both 3D entries open clean.** The sample plan from the landing page and
the plan the wizard builds both open the viewer with the fit note hidden,
"Set exact sizes" reading 2′6″ w × 1′2″ d × 7′ h, and the can rack and
turntable on the middle shelf where the plan sends them. The same script
against `74f19bf` (the commit before the fix) shows the old note, "2
organizers from your list have no spot in this view yet", over a 5′ cabinet,
so the comparison is against the fault and not against nothing.

**Two things the walkthrough turned up, neither a regression of #120.**

- **A stale `area` history entry is dropped before `go()` sees it.** The
  09-03 entry says a history entry naming `area` "lands on a screen that
  exists". It does not throw, but it does not land anywhere either: the
  popstate handler returns early for any screen id without a section
  (`document.getElementById('screen-'+id)`), and that check runs before
  `go('area')` could map it to `space`. Measured by pushing
  `{screen:'area'}` under a setup entry and calling `history.back()`: the
  URL becomes `#area` and the setup screen stays. One Back press appears
  dead for a tab that was open across the 09-03 deploy, and the next one
  works. The `go()` mapping still covers drafts and direct callers. Fixed
  the same day: `resolveScreen()` in `router.js` holds the one rename and
  both `go()` and the popstate handler run ids through it, and the handler
  claims the entry under its new name so the address bar and Forward agree
  with the screen. The scenario is now a test in
  `tests/e2e/history-navigation.spec.mjs`, seen red against the old handler.
- **The top shelf's item labels drew above the canvas at the default
  camera.** The cabinet filled the canvas top to bottom, so "Bulk overflow ·
  Paper goods · Rarely used" was clipped along its top. It was clipped the
  same way at `74f19bf`, before the cabinet grew to seven feet, so this was
  the framing, not the geometry change. Two corrections to what the
  walkthrough first concluded, both from measuring rather than looking:
  the row is the top shelf's *item* labels, which are hidden until a
  sidebar row is hovered (the screenshot's pointer had landed on that row),
  and the phone was not spared, its item labels projected to the same 1.01
  in normalised device coordinates; the vertical field of view is fixed, so
  the canvas aspect never came into it. Nearly every setup's scene had the
  same overhang. Fixed the same day: `fitLabelsInFrame()` in `scene.js`
  projects every label sprite, shown or hidden, and backs the camera off
  along its own line of sight until the highest top edge sits at 0.94, only
  ever moving out. The pantry's camera went from 130 to about 139 inches.
  `tests/e2e/viewer3d-label-headroom.spec.mjs` holds the sample plan and all
  33 setups to it; seen red on 32 of 33 setups against the old framing.

## What the 2026-09-03 session changed (the three decisions #119 left open)

PR #119 merged and deployed on 09-02 (Pages run 124). It had left three
things as decisions rather than changes; all three were taken up, and one of
them turned out to be three bugs, not one.

**The room and area steps are one step.** Step 1 shows all nine spaces,
grouped under their room the way the homepage gallery does; picking a card
sets the pair (`setArea(room, area)`) and Continue goes to the setup shapes.
The wizard is eleven steps: `FLOW` and `WIZARD_STEPS` lost `'area'`,
`#screen-area` is gone from `index.html`, the step labels were renumbered,
and `renderSpace` in `wizard.js` replaced `renderRoom`/`renderArea`.
`go('area')` maps to `'space'` so a stale history entry, `#area` fragment or
draft written before the change lands on a screen that exists. One behaviour
changed on purpose: switching to a space in a *different room* used to go
through `setRoom()`, which reset the spot silently; now every switch is a
card tap and goes through `confirmAreaChange()`, so typed measurements and
photos are protected on that path too (`saved-space.spec` accepts the
dialog). `roomLower()` had no caller left and was removed. Sixteen e2e specs
drove the two old steps by clicking `#room-cards` then `#area-cards`; they
click `#space-cards` once now, and the illustration-motion spec reads the nine
cards on one screen instead of a room pass plus four area passes.

**The sample plan's 3D view opens clean.** "1 organizer from your list has no
spot in this view yet" was, measured from the real path, "2 organizers", and
under it sat three separate faults. (1) The pantry scenario asked for four
10-inch bins at eye level on a 30-inch shelf; two fit. It asks for two. (2)
`targetScore` in `organizerKinds.js` gave "Middle shelf" one point against a
"Top shelf" row on the word *shelf*, and because rows are offered in order
that put the can rack and the turntable on the top shelf, 4 inches of
headroom, before the middle shelf was ever reached; the fit note then said
they did not fit, which was true. Words every level name shares
(`GENERIC_LEVEL_WORDS`) no longer count towards a partial match; the unit
test was run red against the old scoring first. (3) The scenario's pantry was
five feet tall with five shelves, so no gap cleared 13 inches and every can
rack in the catalog stands 13.75; it is seven feet now, a standard pantry
cabinet, and the riser that targeted the top shelf (six inches of headroom)
targets eye level. `data.js` mirrors the needs and geometry for the built-in
fallback plan. `tests/e2e/demo-fit.spec.mjs` walks landing, sample plan, 3D
view, and asserts the note is hidden; it was seen red with the bins back at
four and, separately, with the matcher change reverted.

**The matcher change is a trade, and it is recorded here so nobody re-derives
it.** The partial-match spill-over was never designed; it was an artefact of
scoring on shared words. It did, though, place leftover units somewhere when
the target level was full. Strict matching leaves them unplaced instead, and
the fit note says the level is full, which is what the note was written to
say. Measured with the `three-setup-matrix` approach (each setup's demo
scenario built directly with its raw `productNeeds`, so maxDims rather than
picked products): setups whose demo needs do not all place and fit went from
23 of 33 to 26 of 33. The remaining ones are hand-written scenarios that ask
for more than their own geometry holds (four bins plus two baskets on one
"Top shelf"; hook racks aimed at "Floor / door" rows with a floor surface);
they need the pantry's treatment one by one, or a second placement pass. Open
item 10.

**Nine photographs deleted.** `assets/photos/ba-*`, `ex-cab-after`,
`ex-drawertower`, `ex-garage-shelving`, `ex-overhead-rack`,
`ex-pantry-before`, `ex-storage-*`: nothing referenced them and two were
byte-identical to files still in use. The product PNGs stay, because
`docs/asset-plan.md` records keeping them as a decision and
`plan-shopping.png` is a test fixture. The 09-02 entry below listed
`hero-3d.png` and `plan-steps.png` among the unreferenced; the first is the
WebP's source and the second is one of those kept-on-purpose screenshots.

Gates on this branch: lint clean, `check:types` clean, 531 unit, e2e in the
PR.

## What the 2026-09-02 session changed (site optimisation review)

A full read of the code, a browser walkthrough at 390px and 1280px with axe,
and a load audit of the landing page. Every item below was reproduced in a
browser before it was changed, and the screenshots live in the session
scratchpad rather than the repo. Nothing here touches the backend, the plan
schema, or persistence.

**The landing page claimed a pre-fill that production never does.** "TidyMap
pre-fills what it can see from your photos" was true only with no backend:
`runLocalDetection()` runs when `backendConfigured()` is false, and the real
analysis happens at the build, after the contents step. The copy now says
photos are read when the plan is built. Nothing in the wizard pre-fills from a
photo today; making it true would need a detection call before step 7.

**Three answers the app invented, said back to the user.** The Review screen
called "Use what I have" our default when `recomputePrefs()` deliberately
applies no constraint until the card is chosen, so the report then shipped six
pre-ticked products under "you didn't tell us either way". The household row
and the masthead chip said "2 adults" for a step nobody had opened, because
the wizard default is `present:'no'`, not null, so `householdAnswered()` was
true before the step was shown. And a sample plan's categories were headed
"Item categories you told us about". Fixes: a `householdTouched` flag in
`ANSWER_DEFAULTS` (set by the counters; `householdAnswered()` also reads the
content for rows saved before it and treats `present===null`, the demo and
share spelling of "nobody answered", as unanswered); the Review row says what
the engine does ("A few optional product ideas (our default)"); the chip is
hidden until the step is answered; scenario categories are headed "What a
space like this usually holds" with a "typical" count; and `isSample` reads
every answer (dims typed, household, goals, styles, effort, photos) rather than
three touched flags.

**The shelf map opens with the report.** "Where things go" is the first of the
three parts the homepage promises and `#ch-map` shipped `collapsed`. It opens
now, like the steps; the other three folds are unchanged. Chapter links used
to land the heading under the sticky appbar (and the sticky nav on a phone):
`.chapter` and `.plan-rate` carry `scroll-margin-top`. On a phone the nav
scroller showed three of six links with no sign of the rest; `results.js`
toggles `.more` on the nav while something is past its edge and the CSS draws
a trailing fade only then.

**Navigation and accessibility.** The hamburger stayed open over the product
library because `go()` only closed it when leaving a site page; `closeSiteNav()`
in `ui.js` closes it (and resets the toggle's `aria-expanded`) on every screen
change. The six chapter heads all announced as "Show or hide this section";
they use `aria-labelledby` on their h3 now. `#household-notes` had no label;
the flow footer is a `<nav>` landmark; the copyright year broke onto its own
line because `.footer-legal span` matched the nested `data-year` span.

**Phones.** The landing gallery ran nine full-width cards (3,300px; "What you
get" began 4,548px down); two across under 560px brings the page from 9,197px
to 7,527px and that section to 2,919px. The 3D viewer opened onto chips and a
slider with the canvas 572px down; under 880px the section is a flex column
with `.v3d-body{display:contents}` so the drawing comes first, then the
controls, then the zones. The loading screen said "Analyzing your space" for
a 70 to 90 second wait; it now says one to two minutes and to keep the page
open, and the no-photo path no longer says "personalized".

**Startup weight.** Every visitor fetched supabase-js (216KB) so `getSession()`
could report no session, and demo-scenarios.js (149KB) so a sample plan could
be opened. `initAuth()` scans localStorage for an `sb-*-auth-token` key and
creates the client only then, or on the first sign-in action (`ensureClient()`);
the four `getDemoScenario` call sites (`landing`, `loading`, `customize`,
`products`) import the module on demand, each behind the plan-instance guard
where an await was introduced. The brand woff2 is preloaded. Measured on the
landing page: 53 requests instead of 57, and neither module is fetched until
asked for. `tests/e2e/startup-weight.spec.mjs` reads the network for both, and
for a stored session restoring the account. `personalize.js` and
`setupStructure.js` stay eager: `data.js` and `wizard-data.js` import the
first, and the first imports the second, so deferring them means untangling
that graph, which this session did not do.

**Em dashes.** CLAUDE.md forbids them in user-facing copy and the site had
about 120 of them across `index.html`, the five legal pages, `404.html`, and
the strings in `js/`. All replaced with a period, comma, colon, or brackets.
`tests/copy-conventions.test.mjs` scans the pages (HTML comments removed) and
every string literal in `js/` (comments blanked, literals walked in order so a
regex character class does not read as a string) and fails on any that return.
The two dash placeholders for a missing time (`plan.js`, `results.js`, the
Review row) became en dashes; `planExport.js` accepts either, since a saved
plan can still carry the old one. `citeFace` in `personalize.js` splits at the
first sentence end as well as at a spaced dash, so the step faces stayed
under 60 characters after the cite sentences lost theirs.

**Not changed, and why.** The rating options ("Somewhat useful") did not fit
the question "Is this plan worth doing?"; the question changed to "How useful
is this plan?", the options did not. The room and area steps are two screens
for a nine-item choice the homepage makes in one grid; merging them changes
the 12-step design contract and was left as a decision. The 3D viewer's demo
plan opens with a fit warning ("1 organizer from your list has no spot in
this view yet"), which is organizer-fit logic, not layout, and was left. The
unreferenced images under `assets/` (ba-*, ex-drawertower, ex-garage-shelving,
ex-overhead-rack, ex-pantry-before, ex-storage-*, hero-3d.png, plan-steps.png)
deploy but are never fetched; repo hygiene, not user cost. (All three were
taken up on 09-03; see the section above.)

## Product state in one paragraph

Static ES-module site (no build step) served from GitHub Pages, with a Supabase
backend (project `jwubrtaacveavbkosgtf`): Postgres + RLS, magic-code auth,
private `space-media` storage, and Deno edge functions that hold the AI keys
(BYOK was removed; any `tidymap_key` in localStorage is scrubbed at startup).
The wizard follows the Claude Design step contract, eleven steps since
2026-09-03 (the design's room and area steps are one space picker): `landing
→ space → setup → measure → capture (photos) → household → contents → goals →
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
| 7 | Automated QA | ✅ shipped; now lint + types + 528 unit + 199 e2e, all gating | #22, #90 |
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
  localStorage `anon_id`, debounce + flush-on-hide, honors DNT/GPC and the
  in-app opt-out at `cookies.html#turning-the-counter-on-and-off` (written
  through the shared `js/optout.js` module), fails silently.
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

## The photo preview render thread (PRs #102, #103, #106) — RESOLVED

The render re-stages the space. Input resolution was the lever; the brief was
not the problem. Read this before touching the brief, the model, or the
resolution — most of the obvious moves here have already been made and
measured.

**What is known to be fixed.** `MAX_B64_CHARS = 2_100_000` capped the inbound
request and the model's reply against one constant. Gemini returns 3.2-3.4M
base64 chars, so the guard rejected 100% of renders and the feature had never
once produced an image. Split into `MAX_IN_B64_CHARS` / `MAX_OUT_B64_CHARS` in
#102.

**The evidence base is one render, not three.** This is the correction that
matters. From `function_edge_logs`, every `render-after` POST in retention:

| Time (UTC) | Status | Request bytes | Note |
|---|---|---|---|
| 08-19 21:54 x2 | 502 | 178,989 | size cap, pre-#102 |
| 08-19 23:07 x2 | 502 | 178,989 | size cap, pre-#102 |
| 08-20 04:26 x3 | 429 | 172,174 | rate limited |
| **08-20 04:34:25** | **200** | **172,174** | 1100px — no visible re-staging |
| **08-20 16:57:34** | **200** | **292,074** | 1568px — re-staged correctly |

#102's edge deploy completed 23:31:20Z and #103's at 03:26:03Z, and **no render
was attempted between them**. So the single 200 ran the #103 brief at 1100px,
and there has never been a successful render under the *old* brief to compare
it against. The `js/media.js` comment describing output that "came back
globally brightened and straightened" was authored 04:49:04Z — fifteen minutes
after that render, describing it.

Three briefs were *designed*; one shipped; and at the time only one output had
ever been seen. A claim that a brief change "had no effect" was therefore
measured against expectation, not against a control — which is why the
"stop iterating, three designs is enough" conclusion recorded here was wrong.
The answer arrived on the very next render.

**#106 is what fixed it.** The render upload went 1100px -> 1568px in
`js/media.js`. The 16:57 render came in at 292,074 request bytes against the
172,174 baseline — **1.70x**, where the pixel-area increase is 2.03x and JPEG
compresses large images more efficiently per pixel, so the ratio lands exactly
where a real resolution bump belongs.

It is a clean single-variable result. `render-after` was v28 for both renders
with no edge deploy in between, so the brief, the model and the prompt were
byte-identical; only the input resolution changed. The output went from global
brightening to genuine re-staging: containers upright and front-faced, like
grouped with like, bottles in a single row, shelves given one purpose each —
the operations the #103 brief asks for and the 1100px render ignored.

The mechanism was the one predicted in `js/media.js`: at 1100px across a wide
corner pantry a jar is about forty pixels, near the floor of what an image
model can pick up and put back as a recognisable object. 1568 is Gemini's tile
size.

Its e2e test (`tests/e2e/render-input-resolution.spec.mjs`) is not one of the
vacuous ones — a 1744x1882 source, asserting on the bytes that leave the
browser.

**Still open: object fidelity.** The brief says every object in the result
"comes out of the original photo: the same products, packaging, colours and
count". The successful render put a row of matching fabric bins across the top
shelf where the input had one or two similar baskets elsewhere — so the model
multiplied a container it found rather than only moving what was there. This
is why the disclaimer ("shows the feel, not an exact result") is currently the
honest claim and the button's "See your actual space organized" should not be
strengthened. Watch the object count on the next few renders.

**Reliability is unmeasured.** One good render on one corner pantry. This app
also renders garages, closets and workbenches, and nothing yet says the result
holds across them.

**Reading a render without guessing.** `render-after` logs nothing on success,
but the platform records the POST body size. A render near 172,174 bytes came
from a browser serving a cached `js/media.js` and tested nothing; one near
292,074 sent the 1568px photo:

```sql
select timestamp, log_attributes['response.status_code'] as status,
       log_attributes['request.headers.content_length'] as req_bytes
from logs
where source = 'function_edge_logs'
  and log_attributes['function_id'] = '8aad167e-1e6d-4a9e-ac19-2c500c2c8d20'
  and log_attributes['request.method'] = 'POST'
order by timestamp desc
```

Because it is a *client* change, a warm browser cache silently reverts it —
hard-refresh before reading anything into a render's quality.

**Refuted — do not re-litigate.** Parts order (`[image, text]` is correct for
`:generateContent`; the `[text, image]` guidance belongs to the newer
Interactions API). `responseModalities` including TEXT. `GOOGLE_AI_API_KEY`.
A UI bug showing the same image twice on the live path — though it *was* real
on the reopen path, via `coverUrl()`, and #103 fixed that.

**Iterating used to be rationed; #109 fixed that.** `check_and_log_usage`
writes the usage row on the ALLOW path, before the work is attempted — which is
correct, because it is what lets the check and the insert share one transaction
and one advisory lock. The cost was that a request admitted and then failed
upstream spent an allowance for nothing: at 3/hour and 5/day, a run of Gemini
502s could burn a signed-in caller's whole day without ever showing an image,
and on 08-19 it did — four of five renders were eaten by the size-cap bug and
cleared by hand.

`_shared/usageRefund.js` now removes the row after the fact, wired into
`render-after` for 500/502/503/504: a Gemini outage, refusal, deadline, or
fault of ours. **Not** for `403 not_your_space` — that is a caller sending a
spaceId that is not theirs, and refunding it would let someone probe spaceIds
without ever meeting the rate limit. A wrong request is the one failure worth
charging for.

It is best-effort on purpose: every failure is logged and swallowed, so a
failed refund can never turn a 502 the caller understands into a 500 they do
not, and it never masks the original error. It deletes the caller's *newest*
row rather than tracking the id it inserted, because rows are interchangeable —
`check_and_log_usage` only ever does `count(*)` over them. Under concurrency
two failing requests can select the same row and the second delete matches
nothing, which errs toward under-refunding. That is the right direction to err.

Limits themselves are unchanged: signed in 3/hour and 5/day, anonymous 1/hour
and 1/day, against a 100/day global breaker.

## The 3D viewer: keep it — all four ports shipped (2026-08-21)

A parallel session evaluated whether an `img2threejs` agent workflow should
replace `js/three/scene.js`. The answer was no, and the four upgrades it
proposed porting instead are **all done and deployed** — #112 (PMREM) and #113
(lathe, two-rank packing, labels). The long-form note lives in Notion as
*"TidyMap 3D viewer evaluation — 2026-08-20"*.

**Read this before trusting any note written without a checkout.** That
evaluation read the **deployed** `js/` and never opened the repo. It flagged
two things for a later session to re-verify; in the event, **four** of its
claims were wrong:

| Claim | Reality |
|---|---|
| `RoomEnvironment.js` is vendored, so PMREM is ~5 lines | Not vendored at all. Item 1 needed the addon first |
| geometry vocabulary is 37 Box / 6 Cylinder / 3 Torus | That counts `scene.js` alone; the 13 builders hold the rest |
| the kid-safe hazard warning lives in `interact.js` | It is in `js/screens/viewer3d.js:152-154` and `205-207` |
| `bottle` and `can` "are boxes today" | Both were already `CylinderGeometry` |

Every one of the four was **directionally useful and factually wrong** — the
problems it named were real, the specifics it gave were not. That is the shape
to expect from a note written against deployed output: treat its diagnoses as
leads and re-derive its facts. Two of the four would have caused real work if
acted on unchecked (a five-line PMREM change that cannot resolve its import,
and a `scene.js`-only edit assumed to cover geometry it does not reach).

**The decision, settled — do not re-litigate.**

1. `img2threejs` is an *agent* workflow — Claude Code plus vision review
   iterating on renders — not a runtime library. Roughly fifteen correction
   passes produced one pantry. It cannot run in a browser against a user
   upload, and per-user bespoke geometry would be minutes and dollars per
   space, non-deterministic, and unreviewable at scale.
2. The existing viewer *is* the product feature. Replacing it deletes
   drag-and-drop, zone labels, dimension controls, catalog integration,
   save-arrangement, share read-only mode, and the WebGL fallback path.

### Verified against `main`, so nobody re-derives it

Every line count from the deployed read is exact:

| file | lines | role |
|---|---|---|
| `js/screens/viewer3d.js` | 711 | screen wrapper; lazy-loads three.js (~680KB) on open |
| `js/three/scene.js` | 617 | `buildScene({geometry, map, placements, canvas, layout, organizerPlan})` |
| `js/three/interact.js` | 138 | `attachDrag` — shelf-to-shelf drag with drop validation |
| `js/three/organizerKinds.js` | 113 | product-need to organizer mapping |
| `js/three/viewerOptions.js` | 100 | shelf count / height / L-side normalisation |

Also confirmed: `createSemanticItem(name, kind, color)` with the `KIND_MAX_W` /
`KIND_DEPTH` tables at `scene.js:154-155`; `createOrganizer(type)` at
`scene.js:91`; the renderer at `scene.js:195-199` (`SRGBColorSpace`,
`ACESFilmicToneMapping`, exposure `1.08`, `PCFSoftShadowMap`) and the lighting
at `228-229` (`HemisphereLight(0xfdfff5, 0x8b9184, 1.05)` plus
`DirectionalLight(0xffffff, 1.25)`); and **no PMREM or environment map
anywhere** in `js/three/` or `viewer3d.js`.

Two of those corrections in full, because acting on either unchecked costs
real work:

- **The geometry vocabulary counts `scene.js` alone.** 37 Box / 6 Cylinder /
  3 Torus / 1 each Plane, Extrude, Buffer is exactly right for that file — but
  that file is not the whole viewer. The thirteen builders under
  `js/three/layouts/` add another 2 Box, 13 Cylinder and 1 Torus, for
  39 / 19 / 4 across the drawn scene. A change scoped to `scene.js` reaches a
  little over half the geometry, which matters for items 2–4 below.
- **The hazard warning is not in `interact.js`.** `attachDrag` validates the
  drop; the "hazardous item on a kid-safe shelf" warning is raised by the
  screen's callback, at `js/screens/viewer3d.js:152-154` and `205-207`.

### The flagged blocker, answered: `RoomEnvironment` is not vendored

`vendor/three/` holds exactly two files — `three.module.min.js` and
`addons/controls/OrbitControls.js`. `vendor/three/addons/environments/` does
not exist, so the import map's `"three/addons/": "./vendor/three/addons/"`
resolves nothing for `environments/RoomEnvironment.js`. The PMREM port is
**not** the five-line change it was scoped as; it needs the addon vendored
first, or a hand-built gradient environment in its place. `PMREMGenerator`
itself *is* in the vendored core, so only the room model is missing.

The payoff is real and the diagnosis holds: every metallic material in the
scene renders near-black without an environment to reflect. The worst cases are
`under-sink.js`'s drain and faucet at `metalness: 0.75` and the `hook-rack` and
`door-rack` metal at `0.22`. One point in the port's favour that the evaluation
did not know: `scene.environment` is set on the scene, so a single assignment
in `scene.js` reaches every layout builder's materials — this is the one item
on the list where the `scene.js`-only scope is not a limitation.

### The port list, in order

1. ~~**PMREM environment in `js/three/scene.js`.**~~ **Done** — see "What the
   PMREM port actually took" below. `RoomEnvironment.js` (r166, MIT) is
   vendored, and metal went from 0.15 to 0.66 median luminance while the
   diffuse scene moved 0.1%.
2. ~~**`LatheGeometry` profiles for the `bottle` and `can` kinds.**~~ **Done.**
3. ~~**Two-deep shelf packing with depth and yaw jitter.**~~ **Done.**
4. ~~**Generated 64×96 canvas packaging labels** for `food` and `container`.~~
   **Done.**

The list is finished. None of the four touched plan data, drag, zones, or
persistence, which is why they were ports rather than a rewrite.

### What ports 2–4 took, and one more thing the evaluation got wrong

**`bottle` and `can` were never boxes.** The evaluation's reason for item 2 —
"both are boxes today" — was wrong. They were a `CylinderGeometry` cone frustum
with a cap child, and a straight `CylinderGeometry` with a `TorusGeometry` stuck
on the rim. That is the third claim from that note to miss (after the geometry
vocabulary and the hazard-warning location), and it is the last of them, since
the list is now closed.

The complaint underneath it was still right: both read as tubes, with no
shoulder, no neck and no seam. A lathe is the correct primitive for a
surface of revolution, and here it *removes* a mesh rather than adding one,
because the taper and the rim stop being separate children. Profiles are
authored in the same unit box as every other item — y from -0.5 to 0.5, radius
at most 0.5 — so `reflow`'s `scale(w, itemH, itemD)` lands them exactly where
the cylinders were.

**A full shelf is rarer than the note implied, and worth measuring before
building.** Two-deep packing only does anything where an item has more than one
representative copy, and `visualUnitCount` caps that at three. Swept across all
33 demo setups: **75 of 353 items are multi-unit, on 14 of the 33 setups.** The
pantry the sample plan opens on has none at all — every item there is a single
unit — so the layout most people see is untouched, and screenshotting the port
there proves nothing. Workbench, garage, walk-in closet and bathroom are where
it shows; workbench is 9 of 9.

Copies now sit in two ranks with a small deterministic wobble. Three rules
matter:

- **Copy 0 is the draggable item and never moves.** Only display copies rank or
  wobble, so dragging and every spec that reads an item's position see exactly
  what they saw before.
- **The wobble is a hash, not `Math.random`.** `displayJitter` in
  `surfaceMath.js` is seeded from the item's name and copy index. Randomness
  here would make two renders of one plan differ, which costs the only thing
  this repo checks appearance with — a screenshot — and turns any pixel
  assertion into a coin flip.
- **A back rank is refused where it would be wrong rather than merely tight**:
  inside an organizer the bin decides the arrangement, a rod hangs its contents
  in one plane, and a pegboard has no depth to use.

The failure mode worth knowing is that the second rank is measured from the
first, so an arithmetic slip pushes copies *through* the back of the carcass —
where, at the angle the viewer opens at, they are simply not visible and
nothing looks wrong. `depthRankStep` is swept over every shelf-and-item depth
pair in `tests/three-surface.test.mjs`, and
`tests/e2e/viewer3d-item-detail.spec.mjs` re-checks containment from where the
renderer actually put each copy rather than from the function that decided it.

**The labels had to be paper-dominant, and the first attempt was not.** Bands
derived from the item's own colour is the obvious reading of "generated colour
bands", and on screen it disappears: a blue band on a blue bin is a blue bin.
Real packaging is paper with a coloured header, and that is what reads against
a box of any colour. No lettering and no brand art — type at this scale is a
few pixels of grey mush, and invented packaging is a claim about a product the
user never named.

Four frames in `docs/screenshots/`, each pair captured from the two git states:
`viewer3d-items-*` is the cabinet, where the lathed bottles and the labelled
boxes show, and `viewer3d-packing-*` is the workbench, where the second rank
does. The workbench pair is the one to look at for ranking — the cabinet holds
no multi-unit item at all, which is the measurement above made visible.

### What the PMREM port actually took, and the trap in it

Item 1 is done. `vendor/three/addons/environments/RoomEnvironment.js` is the
r166 addon, matching the `166` revision the vendored core reports, and kept
**byte-identical to upstream** so it can be re-verified in one command:

```
curl -s https://raw.githubusercontent.com/mrdoob/three.js/r166/examples/jsm/environments/RoomEnvironment.js \
  | diff - vendor/three/addons/environments/RoomEnvironment.js
```

sha256 `e1b92c4dd2d89752293546790bfda9828a630a79700c66f5b736fad7a88cb7e4`. All
eight symbols it imports are exported by the vendored minified core, which is
why the bare `from 'three'` resolves.

**`scene.environment` is the obvious way to attach it and it is the wrong one.**
It reads as the elegant choice — one scene-level assignment reaching all
thirteen layout builders — and that is exactly the shape of the trap:

- Its only dial is `scene.environmentIntensity`, which lights **everything**.
  Measured across a sweep: every setting that recovered metal also lifted the
  diffuse surfaces with it, +10% at the lowest setting that moved metal at all,
  +28% at the setting that fixed it. That is a relight of the viewer, not a fix
  for black metal — the wood crates go pale and the carcass goes white.
- **`material.envMapIntensity` does not restrain it.** On this build, IBL
  arriving through `scene.environment` is scaled by `scene.environmentIntensity`
  alone. Setting `envMapIntensity` to 0 on all 85 materials of the cabinet
  scene changed the rendered frame **by not one byte** — verified by hashing
  the canvas screenshot, after an hour lost to reading that null result as a
  stale browser cache. It was not the cache. The knob is inert on that path.

So the reflection is attached per material as `material.envMap` instead, where
`envMapIntensity` means what it says. Metal (`metalness >= 0.3`) gets it at
full, the translucent cabinet and fridge doors at 0.5, and every diffuse
material is left exactly as it was. Still one pass over the built scene in
`scene.js`; still nothing edited in the thirteen builders. Adding an organizer
rebuilds the scene rather than appending to it, so the pass cannot miss a
later material.

Measured on the cabinet layout, lit pixels only:

| | metal median | whole lit scene |
|---|---|---|
| before | 0.147 | 0.6668 |
| metal only (glass off) | 0.656 | 0.6676 |
| shipped (glass 0.5) | 0.694 | 0.7017 |

The middle row is the point: fixing the metal moves the rest of the scene by
0.1%. The remaining lift in the shipped row is the door glass itself, which is
the other half of what the port was for.

`docs/screenshots/viewer3d-metal-before.png` and `-after.png` are the cabinet
layout either side of this change, captured from the two git states with zone
labels turned off so the frame is about materials. The shelf-support posts go
from solid black to silver and the door edges pick up an edge highlight; the
crates, bins, carcass and ground are the same in both.

**It is built once per canvas, not once per build.** The room does not depend
on the plan, the layout or the geometry, and the PMREM pass is the most
expensive single step in a build — 80ms on the software renderer CI uses. A
shelf-count change rebuilds the entire scene, so without a cache every slider
nudge re-derived a cubemap identical to the one it had just thrown away. It is keyed by canvas because the texture belongs
to that canvas's GL context, and it deliberately outlives the build that asked
for it, so `dispose()` does not release it: the viewer's canvas is permanent
and one cubemap is a bounded cost.

That cache cannot help a harness that builds each scene on its own canvas, and
`three-setup-matrix.spec.mjs` builds about sixty of them to read geometry back
out — it went straight past its 90s budget on the first run of this port.
`buildScene` therefore takes `environment:false`, which that spec now passes
and the viewer never does. It reads geometry, layout and item kinds and never
looks at a material, so the reflection was pure cost there. With it, that spec
runs in 17s.

`tests/e2e/viewer3d-environment.spec.mjs` pins both halves, and the pair
discriminates — each mutation is caught by exactly one test:

| Mutation | pixel test | structure test |
|---|---|---|
| port reverted | fails | fails |
| re-attached via `scene.environment` | **passes** | fails |
| `ENV_METAL` set to ~0 | fails | **passes** |

The middle row is why the structure test exists. A future simplification back
to `scene.environment` would look tidier, still show bright metal, pass any
test that only measures metal, and quietly brighten every other surface in the
viewer.

### The bug pattern it told us to grep for is not in this repo

The evaluation hit the same defect twice while building its reference
diorama — **a solid slab used where a frame belonged**: a window "trim" that
covered the pane, and a sink "rim" that lidded the basin. It asked that
`scene.js` be swept for organizers or fixtures built as a plate over an
opening. It was, and there are none:

- Every bin in `createOrganizer` is a base plus four edge walls. `clear-bin`,
  `basket` and `divider` all build the walls separately; nothing lids them.
- The cabinet and fridge doors *are* full-face slabs, but deliberately
  transparent (`opacity: 0.35` and `0.25`) so the contents read through them.
  That is the intended look, not the bug.
- `under-sink.js` builds an open face frame from three bars, with a comment
  saying why.

The companion note about an explode/separation helper needing
`pos = home + (home - centre) * f` does not apply: there is no explode helper
in `js/three/`.

**The reference diorama is not shippable and was never offered as such.** It
lives outside this repo at `~/Claude/Documents/pantry-diorama/`, is hardcoded
to one room, and has no plan data, drag, zones, or persistence. It is a
rendering study to harvest technique from; items 1–4 above are that harvest,
and the list is finished.

## Production health as of 2026-08-27

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
     broken, and it survives longer than the logs do. **This is now the check
     to run by hand; the automated one is the canary in open item 2**, which
     calls the model rather than waiting for a user to.
4. **Stored XSS through a shared plan's icons, closed 09-14 (#134).** A
   `spaces` row is its owner's to write under RLS, `sharedSpacePayload` copied
   `map[].ic` and `existing[].ico` verbatim, `iconFor()` passed any string
   beginning `<svg` straight through (so that saved rows holding the resolved
   SVG kept their icons on a second `normalizeAi` pass), and the report
   `innerHTML`'d both fields raw. Anyone could put `<svg><image onerror=...>`
   in their own row and hand the link to someone else. Icons are now keys and
   the sinks are table lookups; rows saved with the SVG itself are recognised
   by exact match against our own table only, and render pixel-identically.
   Two things worth keeping: the "idempotent normalizer" comment that justified
   the pass-through was the vulnerability, and a Chromium quirk nearly hid it
   from the test, since `<svg onload>` inserted via `innerHTML` does not fire
   there while `<image onerror>` does. The browser test uses the one that runs.
   Checked against production on 09-14 (read-only SQL over `spaces`): 2 rows
   in total, both holding this app's own SVG in `ic`, none matching
   `onerror|onload|<script|javascript:|<iframe|<image`, and none with a
   `share_id` set. Nothing was exploited, and nothing is currently shared.
5. **The function deploy token is dead (09-14).** "Deploy edge functions" run
   20 (weekly, 09-14 12:43 UTC) and run 21 (the #134 merge) both failed at the
   deploy step with `unexpected deploy status 401: {"message":"Unauthorized"}`.
   The token check step passed, so the secret is set; Supabase no longer
   accepts it. Last success was run 19 on 09-07. Consequences and non-
   consequences:
   - **The product is unaffected today.** Nothing under `supabase/functions/`
     changed between run 19 and #134, so what is live equals `main` minus
     #134's string caps, and the canary (open item 2) keeps passing because
     it is calling the function that is actually there.
   - **The next server change will not ship until the token is replaced**,
     and neither will #134's caps. This is exactly the client-half-live,
     server-half-dormant state the workflow was built to end, with one
     difference that matters: it is not silent. The failing run IS the
     alert, the same design as the canary, and GitHub emails the owner on it.
   - **Only the owner can fix it.** Mint a new token (Supabase dashboard,
     Account, Access Tokens), replace the `SUPABASE_ACCESS_TOKEN` repository
     secret, then run "Deploy edge functions" by hand (`workflow_dispatch`)
     rather than waiting for Monday's schedule. Read the function back:
     `analyze-space`'s `ezbr_sha256` must change. A session can trigger the
     re-run but cannot rotate the secret.

   **Confirmed working again 2026-08-21.** Three `analyze-space` POSTs on
   08-20 (04:25, 16:56, 19:17) all returned 200, no 502s anywhere in the 24h
   retention window, and the `spaces` row created 19:17:12 carries
   `plan_meta = {"source":"ai","model":"claude-sonnet-4-6"}`. The outage
   signature — 502s completing in 0.3-1.1s, far too fast to have reached the
   model — is absent.
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
   1 saved space, 1 feedback row, 142 usage events, and **99 telemetry rows,
   every one carrying a real `anon_id`** — 92 `screen_viewed`, 4
   `plan_created`, 3 `shared_plan_viewed`. Do not reason about conversion from
   this.

   The table was cleaned twice. 68 junk rows went first; four more appeared
   afterwards (two from PR #99's CI at 18:35, two from the `main` deploy run at
   19:56, both on code predating the fix) and were deleted once #98 landed. The
   predicate was exact both times, because every `space_saved` row was junk and
   no other event ever had a null `anon_id`:

   ```sql
   delete from telemetry_events where name = 'space_saved' and anon_id is null;
   ```

   `space_saved` therefore now reads **zero**, and that is the honest number —
   there has never been a genuine one.

   Two pieces of direct evidence the fix holds: #98's own unit job ran at 20:21
   **with** the fix and produced no row, and nothing has been written to the
   table since 19:56.
6. **`render-after` has produced two images, ever** — 2026-08-20 04:34:25Z
   (1100px, no re-staging) and 16:57:34Z (1568px, re-staged). Every earlier
   attempt died on the size cap (#102) or the rate limiter. `GOOGLE_AI_API_KEY` is **fine**: Gemini authenticated on
   every call including that one, and the silent-expiry worry recorded here
   before was a false alarm start to finish. See "The photo preview render
   thread" for what that single render does and does not prove.
7. **Telemetry from the owner's own browser may be suppressed.** Do Not Track
   and Global Privacy Control both switch it off (Brave, DuckDuckGo and Firefox
   send GPC by default), and `telemetryStatus()` on `window` says which in one
   line. Check `usage_events` before reading a quiet week as low usage — but
   read #3 above first, because "broken" and "unused" look the same from here.

8. **The funnel is not quiet, it is switched off — and CORS is now ruled out.**
   Measured 2026-08-27. `telemetry_events` has had **no row since 2026-08-04
   16:16**, but real sessions ran well after that: five `analyze-space` calls on
   08-18, two on 08-19, three on 08-20, plus three `render-after` and the
   `spaces` row created 08-20 19:17 carrying `plan_meta.source = ai`. Across
   those same days `usage_events` shows **zero `track-events` calls**.

   That last number is the whole finding. `track-events` logs its usage row
   before it can reject anything, and a CORS rejection is applied by the
   *browser* to a response the function already produced — so a blocked-by-CORS
   post would still leave a usage row. There are none. Nothing left the browser
   at all, which is `optedOut()` returning true, not a wire problem. Open item 6
   named DNT/GPC and the CORS origin list as co-equal candidates; the second is
   now excluded. Check `telemetryStatus()` in that browser first.

9. **Nobody has opened the app since 2026-08-21.** Every backend call in the six
   days to 08-27 is the daily canary — one `analyze-space` per day, no
   `render-after`, no `track-events`, no new `spaces` row. This is not a funnel
   conversion problem and no amount of waiting fixes it. Open items 1 and 6 both
   need a human to run the app once, and item 1 is about twenty minutes of that.

10. **The canary's firing time swings by up to eleven hours, and that is the
    real finding.** An earlier version of this entry said the canary *missed*
    2026-08-27. **It did not.** It fired at **17:41:42Z** that day, succeeded,
    and left its `analyze-space` row in `usage_events` at 17:41:50. The entry
    was written from a check at 15:28Z and called a run that had not happened
    *yet* a run that never happened. Corrected 2026-08-28.

    Every observed firing against a 06:20 UTC schedule:

    | Date | Fired | Late by |
    |---|---|---|
    | 08-21 | 07:12 | 52m |
    | 08-22 | 07:04 | 44m |
    | 08-23 | 07:07 | 47m |
    | 08-24 | 07:32 | 1h 12m |
    | 08-25 | 07:13 | 53m |
    | 08-26 | 07:13 | 53m |
    | 08-27 | 17:41 | **11h 21m** |

    So the alert works and has never failed. What it does not do is run at a
    predictable hour: GitHub schedules `cron` on a best-effort queue, and this
    workflow has now been seen anywhere from 44 minutes to 11 hours late. **A
    same-day absence is therefore not evidence of anything** until roughly a
    full day has passed. Do not conclude "missed" from a morning check, which is
    exactly the mistake this entry used to record.

    The gap in the design is still real, just smaller than it was written up as.
    Open item 2's principle is "the failing run IS the alert", which covers a
    model outage and not the alert failing to run at all: a `schedule` that
    never fires sends no email. GitHub also disables `schedule` workflows after
    60 days with no repo activity, which at this repo's rate is a live risk. But
    no dropped run has actually been observed, so a heartbeat is a precaution,
    not a repair.

11. **The Supabase advisor list had never been read.** Checked 2026-08-27. One
    real item, since fixed; the rest are working as designed, plus one false
    positive worth recording so nobody re-opens it. Re-read the list before
    trusting this entry: it is a snapshot like everything else here.
    - `function_search_path_mutable` on `public.touch_updated_at` — real but
      minor. Migration `0009` fixes it and **has been applied** (2026-08-27), so
      the notice is gone from the live list. It is SECURITY INVOKER, so the
      search_path bought an attacker nothing; the reason to fix it is that an
      advisor list which is always slightly red stops being read, which is the
      same failure mode as the expired key.

      **Pinning `search_path` was verified to still work, not assumed to.**
      `set search_path = ''` is exactly the change that silently breaks a
      function body which resolves any unqualified name. This one resolves
      none — `now()` is in `pg_catalog`, always searched — and that was proved
      by attaching the function to a throwaway temp table and confirming an
      update moved `updated_at` off its default. `spaces_touch` on
      `public.spaces` is still present, still enabled, still bound to it.
    - `rls_enabled_no_policy` on `feedback`, `invite_requests`,
      `telemetry_events`, `usage_events` — **intended.** RLS on with no policies
      is how the anon key is denied everything; PR #45 and migration `0008`
      closed those direct paths deliberately. Adding a policy to silence the
      linter would reopen them.
    - `anon_security_definer_function_executable` on `handle_new_user` — a
      **false positive**, measured not assumed: it already pins
      `search_path = ''`, its return type is `trigger`, and calling it directly
      on this database returns `sqlstate=0A000 :: trigger functions can only be
      called as triggers` with `public.profiles` unchanged.
    - `extension_in_public` — `pg_net` is installed in the `public` schema.
      Left alone: it is a Supabase default rather than something this project
      chose, and relocating an installed extension is invasive for no gain
      here. Named explicitly because the first pass through this list missed it,
      and an advisor entry nobody has accounted for is how the whole list starts
      getting skimmed.
    - Auth's leaked-password protection is off. Left off: sign-in is magic-code
      only, so there is no password for HaveIBeenPwned to check. Revisit only if
      password auth is ever enabled.

    So the live list is now four `rls_enabled_no_policy`, two on
    `handle_new_user`, `pg_net`, and leaked-password protection: eight notices,
    every one of them a decision. That is the state to compare against, and a
    ninth appearing means something actually changed.

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
- Edge functions live, versions as of 2026-08-20: `analyze-space` v35,
  `render-after` **v29**, `get-shared-space` v22, `track-events` v22,
  `submit-form` v19. A version bump alone does not prove a deploy shipped your
  code — check `ezbr_sha256` changed too. #109 took `render-after` from
  `2d822988…` to `7c448fba…`. All `verify_jwt: false` — they check JWTs themselves so
  guests can call them. CORS allowlist in `_shared/cors.ts` (Pages,
  scmsolutions.org, localhost:8000/8123). **Note 3000 is not on
  that list**, so a local dev server on that port gets a preflight failure and
  telemetry silently never sends.
- **Production matches `main` automatically now.** Since 2026-08-12 the same
  merge that publishes the site publishes the functions
  (`.github/workflows/supabase-functions.yml`, requires a `SUPABASE_ACCESS_TOKEN`
  repo secret). The old advice to deploy by hand and read the function back is
  obsolete for the normal path — but the workflow deliberately omits
  `--prune`, so **deleting** a function is still a manual `supabase functions
  delete`. **The token can die**, and when it does the deploy step fails with
  a 401 and the run goes red (Production health #5, 09-14). A red "Deploy edge
  functions" run means `main` and production have diverged for the functions;
  do not read a green Pages run as "deployed".
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
  (`tsc --checkJs` over a scoped `jsconfig.json`), `npm test` (**537 tests**
  across 43 files), and `npx playwright test` (**222 tests** across 46 files).
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

### Environment traps in a fresh session

- **`node_modules` starts empty.** `npm run check:types` reports **783 phantom
  errors** until `npm ci` has run, and they read exactly like a regression from
  whatever you just changed. Run `npm ci` before believing any gate output.
- **The sandbox cannot reach the project domain.** The network policy denies
  `jwubrtaacveavbkosgtf.supabase.co`, so you cannot call `render-after`
  yourself to test a render — Supabase MCP works, direct HTTPS does not.
  Renders need the user's browser. Anonymous callers are also capped at 1/day,
  so an A/B from one IP is impossible regardless.
- **Repo photos cannot serve as render fixtures.** Everything in
  `assets/photos/` is 1000px or less on the long edge after the #96 WebP
  re-encode, so neither the 1100 nor the 1568 cap scales them, and
  `ex-cab-before.webp` is literally the 418x630 fixture named above.
  `tests/e2e/render-input-resolution.spec.mjs` uses
  `assets/product/plan-shopping.png` (1744x1882) for exactly this reason.

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

#### Stashing proves the test needs the FILE, not that it discriminates

An eighth example, caught during #109 and worth the technique it took. The
refund tests were written carefully and all eight passed. Then five realistic
bugs were written into the implementation to check the suite rejected each:

| Mutation | Caught? |
| --- | --- |
| anonymous scope drops `user_id is null` | yes |
| signed-in caller scoped by `ip_hash` | yes |
| `order by id` ascending, taking the oldest row | yes |
| **lookup error not checked** | **no — escaped** |
| empty-result guard removed | yes |

The escapee was a test named *"a failed lookup is swallowed and deletes
nothing"*. Its fixture paired the error with `data: null`, so with the error
check disabled the empty-row guard caught it instead and every assertion still
held. The test named the error path and never exercised it. Stashing the module
would not have found this — the test does need the file; it just does not test
what it says.

The fix was to return a *usable* row alongside the error (`data: [{id: 99}],
error: {...}`), so only an implementation that actually reads `error` can
decline to delete it.

**Do this for any test guarding logic that matters:** break the implementation
in the specific way the test claims to prevent, and confirm it goes red. It is
cheap, and here it found a vacuous test in a file written with this whole
section in mind.

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
- ~~Room and area as two steps~~, ~~the sample plan's 3D fit warning~~,
  ~~unreferenced images under `assets/`~~ — the three decisions #119 left
  open, all taken up on 09-03. See that session's section.
- ~~Open item 10, the 32 other setups' fit notes~~ — closed 09-08. Every
  setup's wizard run with no backend opens its 3D view clean, and
  `demo-fit.spec.mjs` walks all 33 to hold it there.
- ~~Stored XSS through the plan's icon fields~~ — closed 09-14 in #134
  (Production health #4). Batch 1 item 1 of the 09-14 site review; the rest of
  that review is open item 12.

## Open items / next actions

Ordered by whether anyone can act on them today.

### Actionable now

1. **Confirm the render holds across space types.** The 1568px fix is proven
   on one corner pantry (08-20 16:57, 292,074 bytes). Garages, closets and
   workbenches are unmeasured, and object fidelity — the model multiplied a
   container rather than only moving what was there — is the open question.
   Check object count against the input on each one. Since #109 refunds a
   failed render's allowance, this no longer costs a day's quota per failure.
   See "The photo preview render thread" above.

   **This is the top of the list as of 08-27, because it is the only open item
   that does not depend on anyone else.** Nobody has opened the app since
   08-21 (Production health #9), so nothing on the "waiting on traffic" list can
   move until somebody runs it — and running it once is exactly what this item
   asks for. Twenty minutes of one person's browser closes item 1, produces the
   `telemetryStatus()` reading item 6 needs, and generates the first funnel rows
   in three weeks.
2. ~~**Nothing alerts on a broken model path.**~~ **Built.**
   `.github/workflows/model-path-canary.yml` calls `analyze-space` for real
   every day at 06:20 UTC and fails the workflow if it does not get a plan
   back. The failing run IS the alert — GitHub emails the owner on a failed
   scheduled run, so there is no secret, no third party and nothing else to
   keep alive. **If those notifications are ever turned off this alert stops
   existing**, which is the one thing to keep true about it.

   **Why it calls the model instead of reading the database.** The cheap check
   this entry used to recommend — `plan_meta->>'source'` on the newest `spaces`
   row — is free and it is still the right thing to read by hand. It is the
   wrong thing to *alert* on: it only says anything when somebody uses the app,
   and at this app's traffic an outage can run for weeks with no new rows at
   all. Silence there is indistinguishable from health, and that silence is
   exactly what let the last outage run two weeks. So the check generates its
   own traffic. It costs one real Sonnet call a day and uses 1 of the
   anonymous allowance of 6/day on `analyze-space`.

   **It reports two different failures on purpose.** A 5xx from `analyze-space`
   is the outage, and says so. Anything else — a rejected request, an
   unreachable host, a contract that moved — says the *canary* could not run,
   because announcing "model path broken" for a misconfigured check sends
   somebody to rotate a perfectly good key. Both exit non-zero: a check that
   could not run must never report success. That distinction was not
   hypothetical — the first run of the script hit a 403 from this sandbox's
   egress proxy and confidently announced the model was down.

   Every branch was proven against a local stub rather than assumed: 200 with
   a plan passes; 502 (carrying the real `authentication_error` body) and 504
   fail as the outage; 400, a 200 with no plan, and a twice-rate-limited run
   all fail as the canary. Run it by hand any time with
   `npm run check:model-path`.
3. ~~The AI photo preview may be undiscoverable.~~ **Settled, and fixed in
   #101.** The button was present and 0px tall: `#ch-after` ships `collapsed`
   and `.chapter.collapsed .ch-sub` is `display:none`, so nothing inside the
   chapter could advertise itself. A flag in the chapter head now survives the
   fold.
4. ~~**Step-length caps are unvalidated server-side.**~~ **Built.**
   `checkInvariants` now checks every step's `task` and `why`, reporting per
   step so a retry is told which one to shorten. The prompt's enforced-limits
   block interpolates the same two constants, so the pair cannot drift.

   **The limits are 12 and 18, not the prompt's 8 and 12, and that gap is the
   whole design.** Validating at the number the prompt asks for would throw away
   an 80-second analysis over a ninth word — the same mistake as the three
   earlier invariant bugs, and the same shape as the safety rule that would have
   put heavy bins overhead. The numbers were measured against this app's own
   deterministic scenarios, which are the closest thing here to house-authored
   reference prose and the answer a rejected plan lands on: `js/demo-scenarios.js`
   runs up to **11** words of task ("Group mugs on the lower shelf with a riser
   if available") and **16** of why. A cap at 8 would have rejected the fallback.
   Re-measure before lowering either number.

   The two behavioural tests were checked by neutering the loop with the
   constants and the prompt line left in place, so they discriminate the check
   rather than the file.

5. ~~**Port the four 3D viewer upgrades.**~~ **All four are done and live**
   (#112, #113; Pages run 118). See "The 3D viewer: keep it — all four ports
   shipped" above for what each took, for the two traps recorded there — the
   three.js knob that is inert on the `scene.environment` path, and the hash
   rather than `Math.random` that keeps a screenshot usable as evidence — and
   for the four-row table of what that evaluation got wrong. Nothing from it is
   left open. The one judgment call still open to revision is whether the
   second rank should exist at all: it changes 21% of items and nothing in the
   pantry most users see, and it comes out by deleting the `depthRankStep` call
   in `reflow`, which takes its containment test with it.

9. ~~**The canary has no heartbeat.**~~ **Done in #171.** The workflow gained
   a second step that reads its own recent successful runs through the GitHub
   Actions API (via `GITHUB_TOKEN` with `actions: read`, no new secret) and
   fails as `CANARY HEARTBEAT LOST` if the last one is over 36 hours old.
   Runs `if: always()` so a schedule gap is reported alongside a model-path
   outage rather than hidden behind it. Neither of the two options the
   entry proposed was taken: a committed timestamp would have wanted
   `contents: write`, which #169 just took away for exactly the right reason,
   and reading `usage_events` would have needed the service-role key shipped
   as a new secret to the runner — the API path is smaller than either.

   **Threshold set to 36h, not the entry's 30h.** The 30h floor was measured
   against the 08-27 pattern only. The worst-case normal gap between two
   consecutive completions on a 24h schedule is `24 + max_jitter` — with
   observed jitter of 0 to 11h 21m, that is ~35.5h without any run being
   missed, so 30h would false-alarm on a late-but-fired run's follower. 36h
   clears the observed jitter with a small margin and still catches a missed
   day (≥48h). The `36h clears the worst observed jitter without
   false-alarming` test pins this to the observation rather than to the
   number itself.

   **Three exit modes, following the canary's own precedent:** fresh under
   36h passes; stale over 36h fails as `HEARTBEAT LOST`; and any
   could-not-check case (API error, malformed response, missing env) fails
   under its own `HEARTBEAT CHECK COULD NOT RUN` header so nobody rotates
   the API key over a schedule issue. Bootstrap (no prior successful run at
   all — first deploy, rebased history, runs rolled off) exits 0 with a
   note, since the current run cannot be its own predecessor.

   Every new behavioural assertion proven red by neutering only its own fix
   with file copies rather than `git checkout`: threshold to `Infinity` (4
   red, including the boundary case that underflows), the current-run skip
   removed (3 red), and the workflow's `actions: read` grant put back (1
   red). Files then restored from the scratchpad backups.

10. ~~**26 of the 33 setups' demo scenarios ask for more than their own geometry
    holds.**~~ **Closed 2026-09-08.** The real number was 25 of 33 on the
    path a visitor takes, and it is 0 now; see that session's section for
    the six causes and the one convention deliberately left alone.
    The original entry, for the record: measured on 09-03 by building each setup's demo scenario the way
    `tests/e2e/three-setup-matrix.spec.mjs` does and reading
    `scene.userData.unplacedOrganizerQty` and the plan-sourced organizers with
    `fits===false`. Only the pantry (the sample plan every visitor sees) was
    fixed. The other scenarios are hand-written: the garage wall cabinet wants
    four bins and two baskets on one "Top shelf", the closets aim hook racks at
    "Floor / door" rows whose surface is a floor, the drawers want three
    organizers in one "Top drawer". Each needs the same treatment the pantry
    got (quantities, target levels and geometry that agree), or the placer
    needs a second pass that offers a need's leftovers to other rows on the
    same surface. Until then a wizard run with no backend opens its 3D view
    with a true but unflattering fit note on most spaces. Do not fix this by
    softening the matcher back to shared-word matching; that put organizers
    on the wrong level and then warned that they did not fit.

11. **Replace the function deploy token.** Owner-only, ten minutes, and it
    gates every server-side item below. Production health #5 has the steps.
    Until it is done, treat any PR that touches `supabase/functions/` as
    merged-not-deployed, and say so in its handoff line.

12. **The 2026-09-14 site review, everything except item 1.** A full pass
    (security, browser UI/UX with axe at 390 and 1280, throttled performance,
    copy and SEO) whose top claims were verified in source by the reviewer.
    Item 1, the icon XSS, shipped in #134, batch 1's pantry item in #136, and
    its 3D-viewer item in #138. Nothing else is fixed. Each batch is roughly
    one PR per line; the security items in batch 1 come first.
    Not verified from the sandbox: live-site headers and contents, and the
    hosted auth config.

    **Batch 1, fix now.**
    - ~~Pantry is pre-selected as the user's answer (`js/state.js` `space:'pantry'`).
      Add a `spaceTouched` flag, unselected cards, Next disabled, "(our
      default)" on Review.~~ **Done in #136.** `spaceTouched` is an answer in
      `ANSWER_DEFAULTS`, so it round-trips through the draft and the row;
      `setArea()` sets it (the wizard card, the landing gallery and the Product
      Library all pick through it) and `restart()` passes `chosen:false`. The
      cards render unticked and Continue stays off until a pick; Review labels
      Room and Spot as ours when untouched; the report's `answeredAnything`
      counts the pick. A saved row from before the flag reads its space as
      chosen, because it was saved as a plan for that space. `state.space`
      still holds `'pantry'` underneath: the setup list, the dims and the demo
      scenario read it, and a null there would have meant touching all three.
      Each of the six new assertions was proven red by neutering only its own
      behaviour. Left alone on purpose: the setup card is still preselected and
      ticked, and Review prints it without a label. That is batch 2's "Room and
      Spot as two rows" neighbour, not this item.
    - ~~The 3D viewer says "matches your space" and "estimated from your photos"
      on sample plans (`index.html` ~847, `js/screens/viewer3d.js` ~267).
      Branch on `planMeta.source` and `uploadedFiles`.~~ **Done in #138.**
      Whose plan it is and whether a photo was read live in one rule,
      `js/planProvenance.js` (`planFromPhotos`, `planIsSample`,
      `answeredAnything`), which the report's byline and the viewer both
      read; a unit test refuses either screen its own `planMeta.source`
      comparison. `source==='ai'` is the signal, not `uploadedFiles`: a
      failed analysis (`demo-fallback`) keeps the files and read none, and a
      saved analysis reopened from the dashboard has no files in memory and
      was read from them. The viewer's heading, its intro (`#v3d-intro`,
      written at open) and its status line have four readings: the sample
      ("The sample pantry, standing up", "Dimensions are the sample's, not
      yours"), a wizard plan without photos ("No photos were added"), a photo
      plan (wording unchanged), and a share view, which says "the plan's"
      where it said "your". The share view was the one place "matched from
      your photos" could actually print: a shared plan carries no setup, so
      `resolveLayout` answers `ai` from the plan's own layout whatever the
      plan came from. Browser-checked on all three own-plan cases and the
      share fixture; each new assertion proven red by neutering only its own
      behaviour. Left alone on purpose: "Built from your measurements" and
      "Shown as your cabinet" on a wizard run whose measure and setup steps
      were passed untouched. Those are batch 2's setup-card and
      Measurements-row neighbours, and Review prints both unlabelled too.
    - ~~"Analyzed by Claude" appears twice on the report (`results.js` badge ~39
      and byline ~86).~~ **Done in #140.** The badge is the credit and carries
      the model ("Analyzed by Claude · Sonnet 4.6"); the byline says the basis
      in the same shape as its other readings ("Personalized plan · based on
      your photos and selections"). Putting "your photos" in the byline made a
      share view print it to a visitor who took none, the claim #138 removed
      from the 3D view, so the byline has a share reading now ("Shared plan ·
      based on the owner's photos", or "answers"). The failed-analysis test
      used to assert only that the byline did not say "analyzed by", which it
      never says any more; it asserts the badge is hidden too. Each new
      assertion proven red by neutering only its own behaviour; all five
      readings browser-checked at 390 and 1280.
    - ~~The auth modal shows a raw "Failed to fetch" (`js/auth.js` ~80).~~
      **Done in #142.** supabase-js reports a request that got no answer
      as an `AuthRetryableFetchError` carrying the browser's own fetch text,
      and a 5xx the same way with the response body as the message; the
      modal's reading passed anything it did not recognise straight through,
      so a bad connection printed "Failed to fetch" and a 503 printed "{}".
      The library load (a dynamic `import()` of the vendored bundle) sat
      outside the catch, so a first visit with no connection printed the
      loader's text instead. `sendCode` and `verifyCode` now run the load
      and the request under one catch, and `authErrorMessage(error, stage)`
      reads the error by name, status and code: no answer is the
      connection, a 5xx is the service, 429 is too many attempts (GoTrue's
      send-again text, "you can only request this after 59 seconds", does
      not contain "rate", so the old `/rate/` reading missed it), and
      nothing unrecognised reaches the modal; the callers log the raw
      error instead. The stage argument exists because "invalid" on send is
      a refused address, and the old one-size reading told that person to
      check the newest email for a code that never went. Six of the seven
      unit assertions proven red by putting the old reading back inside the
      function (the seventh guards the wrong-code reading, which the old
      code got right); the four browser tests cut the auth routes at the
      browser and go red on the exact raw text. Browser-checked at 390 and
      1280.
    - ~~Rate-limit copy: `js/api.js` ~70 drops `retryAfterSeconds`, and the
      `results.js` ~170 banner reads the same for quota and outage. Branch on
      `code === 'rate_limited'` and print minutes.~~ **Done in #143.**
      `callFn` builds the 429 message from the wait (`waitText`: "in about
      30 minutes", "in about an hour", "in about 6 hours", the old "a little
      later" when the number is missing or unusable) and names the function
      that ran out, so the photo preview no longer reports an "Analysis
      limit". The limiter's values are fixed windows (1800 hourly, 21600
      daily, 3600 global breaker, `check_and_log_usage`), not an exact
      reset, which is why the copy says "about". The banner could not
      branch because `loading.js` reduced the error to its message before
      the report saw it; the code and wait now travel as `state.aiFailure`
      (reset with `aiError` in `resetPlanRecord`, `runLoading` and
      `retryAnalysis`, never persisted), and `analysisFailureCopy` in
      `api.js` gives the banner its two readings. Taken from batch 2 on the
      way: the loading line's `&mdash;` in `loading.js`, because the
      rate-limit message was the first that did not already end "Showing
      the demo plan instead." and "minutes. — showing" read badly; the
      suffix is appended as a sentence when the message lacks it. The
      copy-conventions test still does not check `&mdash;` in JS; that half
      of the batch 2 line stands. Each unit assertion proven red by
      neutering only its own behaviour; the browser test for the rate limit
      goes red on its own when `loading.js` drops the failure, which no
      unit test can see. Browser-checked at 390 and 1280, loading line and
      banner both.
    - ~~`security.html` makes three false claims: that CORS blocks requests (it
      only hides responses, `_shared/cors.ts`); that the salt rotates daily (it
      is a static salt plus the date, `_shared/auth.ts`); that guest use
      touches no database (`usage_events`, `telemetry_events`).~~ **Done in
      #144.** Each sentence now says what the code does: the CORS
      allowlist decides who may read a response, the request still arrives
      and still counts against the limit, and a non-browser client is not
      bound by it at all; the hash is `ip|date|salt` with one static secret,
      so the date is what varies, and the page says what that means (not
      reversible without the salt, testable with it, which is why the salt
      lives only in the backend's environment); guest use writes no account
      data but every call writes a usage row and, without DNT or GPC, the
      telemetry rows. The privacy policy carried the same salt sentence
      ("short-lived", "changes daily"), so that one sentence changed with it
      and its effective date moved; "short-lived" was wrong too, since
      nothing purges `usage_events` (batch 3). The rest of the legal line
      (video, Resend, the five undisclosed events, the terms redaction
      sentence) is untouched. Three tests in `legal-pages.test.mjs` tie each
      claim to the code that makes it false (`auth.ts`'s hash shape,
      `ratelimit.ts`'s `check_and_log_usage`, `cors.ts`'s headers), and
      switch themselves off if the backend changes so the claim would be
      true again; each proven red by putting the old sentence back.
      Browser-checked at 390 and 1280.
    - ~~Legal: `privacy.html` and `terms.html` promise video while the input is
      `image/*`; Resend is missing from privacy; five telemetry events are
      undisclosed (`_shared/telemetryEvents.js`); dates are stale; `terms.html`
      lacks the safety-note redaction sentence.~~ **Done in #145.** Privacy
      says photos rather than photos and videos, names Resend under "Where
      your data lives" (verified from the sandbox: the Resend account's one
      sending domain is `scmsolutions.org`; not verified: the hosted Supabase
      Auth SMTP setting), and its usage-data paragraph lists all ten events
      in the server allowlist with what each carries. Terms drop the video,
      carry the redaction sentence, and date today; privacy's date moved in
      #144. Four tests in `legal-pages.test.mjs` tie the claims to the code
      (the input's `accept`, the allowlist with a name-to-words map that
      fails both on a new undisclosed event and on a disclosure that
      outlives its event, `sharePayload.js`'s `householdPatterns`, and the
      security page's provider list), each proven red by putting the old
      text back. Left alone: the "Last reviewed" dates on `cookies.html` and
      `accessibility.html`, which nobody reviewed. **That was the last line
      of batch 1.** Batch 2 is next.

    **Batch 2, UX, accessibility, copy.**
    - ~~Shelf-map tint is inverted (`css/components.css` ~181 vs ~190; swap
      `--surface-3` and `--primary-bg` at the use site). DESIGN.md says the
      eye-level zone is the accent one.~~ **Done in #147.** The two rules
      name `--tint` and `--tint-2` directly, the tokens DESIGN.md names,
      rather than swapping the aliases: `--surface-3` and `--primary-bg`
      sound like a hierarchy and are not one (the first lands on the accent
      tint, the second on the grey). The landing figure and the report's
      elevation drawing already read the right way. The design test
      resolves the `var()` chain through `tokens.css` and asserts the
      colours, not the names, so a re-aliasing has to keep the eye-level
      zone the tinted one; each of its two shelf assertions proven red by
      putting its old token back alone. Browser-checked on the sample plan
      at 390 and 1280. Seen on the way, not fixed: the "Loaded the sample
      pantry plan" toast sits over the shelf map at 390, the same toast
      the last line of this batch says covers the Summary heading.
    - ~~Progress rail reads 100% then 75% then 81% after Review
      (`js/router.js` ~154-165).~~ **Done in #148.** `setRail` had one
      formula for wizard steps (step over eleven) and another for every
      other screen (the screen's index in `FLOW` over `FLOW`'s length),
      and the second did not know the first had finished. The rail is the
      wizard's now (`railPercent`): empty before it, a step at a time
      through it, full on every screen past Review, the 3D view included
      so the report and the drawing do not move it. A unit test walks
      `FLOW` and refuses any drop; a browser test builds a plan through
      the real steps and reads the rail on Review, loading and the report.
      Both proven red on "loading reads 75% after 100%". Browser-checked
      at 390 and 1280.
    - ~~Mobile nav is not modal: no Esc, outside click, scroll lock or Tab trap
      (`index.html` ~49). Use `closeSiteNav()` in `js/ui.js`, add `inert`.~~
      **Done in #149.** `openSiteNav`, `closeSiteNav` and `toggleSiteNav`
      in `js/ui.js` are the only entry points, so the body class, the
      toggle's `aria-expanded`, the scroll lock, the listeners and the
      inert page (`main` and the footer) are always set together. Escape
      closes and refocuses the button; an outside tap closes in the
      capture phase so "Sign in" still opens; Tab cycles the running head;
      opening focuses the first item. Desktop untouched: the listeners
      exist only while the menu is open. Five browser tests at 390, each
      proven red by neutering one half alone (the key listener, the click
      listener, the scroll lock with inert). Browser-checked at 390 and
      1280.
    - ~~3D sliders have a 4px track (`css/screens.css` ~75).~~ **Done in
      #150.** The input's box is 44px, pulled back into the 4px footprint
      with negative margins; the rule is drawn on the track pseudo-element
      and the thumb centred on it, so the panel is the height it was. A
      browser test at 390 asserts the box, that it paints nothing itself,
      that the row did not grow, that no two targets overlap, and a hit
      test in the padded band; proven red with the 4px box back and with
      the box left in flow. Browser-checked at 390 and 1280.
    - ~~Tap targets under 44px: report checkboxes 19px, retailer links 15px,
      segments 32px, `.btn-sm`, `.home-link`, `.ch-head`, `.wr-edit`. Pad,
      don't grow.~~ **Done in #151.** Text controls take padding and hand
      the space back with negative margins; the chapter head turns six of
      the 16px below it into padding; the checkbox gets a 44px label pulled
      back into its 20px column; bordered controls take the tap in a
      pseudo-element band (5px above and below a small button, 12px below a
      segment, because the sticky progress bar sits over the steps toggle).
      Two siblings the review did not list came along: the six 14px footer
      links (real padding, since that row wraps) and the product cards'
      "Details & other options" summary. Four browser tests at 390, each
      of eight rules proven red alone. Browser-checked at 390 and 1280.
    - ~~No skip link; no h1 off the landing page (axe `page-has-heading-one` on
      wizard, report and 3D).~~ **Done in #152.** Every screen's title is an
      h1 at the size it had (the base h1 takes the old h2 size; the landing
      hero keeps its display size in `landing.css`), and the headings beneath
      move up a level with their selectors renamed. A skip link is first in
      the body of all seven pages and lands on `main`, which takes focus.
      The accessibility statement drops its disclaimer. Three unit tests
      (skip link and landmark on every page, the statement against the site,
      an h1 per screen section) and three browser tests (Tab reaches the
      skip link first and Enter lands on main; one h1 per reachable screen;
      axe heading-one and heading-order on wizard, report and 3D), each
      proven red by neutering its own half. Browser-checked at 390 and 1280.
    - ~~3D canvas has no role, label or tabindex, and rearranging is drag-only.~~
      **Done in #153.** The canvas is `role=application`, `tabindex=0`,
      named for the space by `updateHeading` and described by a visible
      keys line; a hidden live region reads each step. `interact.js`
      carries the pointer drag's moves on the keyboard: Left and Right
      choose an item, Space or Enter picks it up, Up and Down carry it
      between surfaces and Left and Right along one, Space or Enter puts it
      down through the same `canDrop` and `onDrop` as a drop, Escape or
      blur puts it back. Five browser tests on the sample pantry (role,
      name and description; choosing and what is said; a move that lands
      one shelf down and enables Save; Escape restoring; along a shelf
      with the ends named), each proven red by neutering its own half.
      Browser-checked at 390 and 1280.
    - ~~Rating buttons carry no ARIA state (`js/screens/feedback.js` ~24-38).~~
      **Done in #154.** Each rating button carries `aria-pressed`, kept in
      step on every tap on the report's inline ask and on the feedback
      screen, and each set is a `role=group` named by its question.
    - ~~`aria-label` on a div (`results.js` ~807): add `role=list`.~~ **Done
      in #154.** The shelf's items are `role=list` and each chip a
      `listitem`, so the label attaches to something. Three browser tests
      (state flips per tap and the groups are named; a report answer shows
      pressed on the feedback screen; every shelf's items are a labelled
      list), each proven red by neutering its own half.
    - ~~Space cards: radiogroup with roving tabindex.~~ **Done in #155.** The
      cards are a `radiogroup` named by the step's question, each card a
      `radio` with `aria-checked`; one card holds the Tab stop (the chosen
      one or the first) and the arrows move and choose with Home, End and
      wrap, a tap moving the stop. `markSelected` drives `aria-checked` on
      radios and `aria-pressed` elsewhere, so the other steps are
      untouched. Three browser tests (role, name and single Tab stop; the
      arrows, Home, End and wrap; a tap keeping the stop across a screen
      change), each proven red by neutering its own half. Browser-checked
      at 390 and 1280.
    - Copy. ~~"green notes" (`results.js` ~269; nothing is green); Review shows
      "Room" and "Spot" as two rows after the merge (`wizard.js` ~728); "your
      14" shelf" on the landing page (`index.html` ~248); TOC and chapter heads
      disagree (`index.html` ~589-591 vs ~629, ~664); "room" headline
      (`index.html` ~105); 8-digit vs "6-8 digit" code (`index.html` ~78,
      `account.js` ~111); `&mdash;` in `loading.js` ~332 (gone in #143), and
      extend the copy-conventions test to JS; UK and US spelling mixed;
      `planExport.js` ~135 prints inches to metric users; "Extracting key
      frames" shown on photo runs (`js/data.js` ~182).~~ **Done in #156.**
      "The notes below"; one "Space: Pantry · Kitchen" row on Review; "a
      14″ shelf"; the contents list carries the chapter headings' own words
      and the desktop column wraps the longest; "space" in the hero;
      neither sign-in sentence names a code length (the hosted auth config
      sets it and the repo cannot see it); the copy-conventions test reads
      the `&mdash;` entity in scripts and refuses British spellings in
      copy (three words were); the shopping list prints the reader's
      units; the loading labels are split by media kind. Pinned by
      `tests/copy-review.test.mjs` and a TOC browser test at 390 and 1280,
      each proven red with the old copy back alone. Browser-checked at 390
      and 1280.
      ~~Silent autosave loss on 401 (`js/db.js` ~145, ~159) and the guest
      reload toast hiding photo loss (`js/startup.js` ~91).~~ **Done in
      #157.** `persistSpace` carries the PostgREST error as the thrown
      error's `cause`; `sessionExpired` reads it (401, `PGRST301`, a JWT
      message); `warnSaveFailed` says once per plan instance that the plan
      is not being saved, naming an expired sign-in, and a patch refused
      for one keeps its keys and arms no retry. The guest draft records
      `hadMedia`, the restore reports `lostMedia`, and the reload toast
      says the photos were not kept. Unit tests for the expiry check, the
      once-only notice, the kept patch and the draft flag; browser tests
      for a 401 on the report (notice once, no "Saved") and a reload with
      and without a photo. Each proven red by neutering its own half.
      ~~Still open from this line: the rating scale mixing usefulness with
      "I would pay" (`js/data.js` ~174), which needs a feedback column and
      its own PR.~~ **Done in #159** (the rating-scale split), see the
      header.
    - ~~Desktop step clips letterbox (`components.css` ~439, ~455); empty ruled
      cells in two-card room groups (`landing.css`); the toast covers the
      Summary heading; the brand link is `href="#"`.~~ **Done in #158.** The
      toast sits over the running head (the one band nothing is read from)
      and the `--foot-h` plumbing it needed at the bottom is gone; it is
      sized by its text up to 90vw or 560px, since `left:50%` with no
      width had capped it at half the viewport. The clip band is
      `min(100%, 392px)`, the clips being 4:1 at 98px. The gallery's box
      came from a dead grouped-picker rule sharing `.space-group`; the
      rules are removed. The brand goes to `index.html`; the dashboard's
      Sign out, the other `href="#"`, is a 44px button. Two hygiene tests
      (no `href="#"`, the dead rules stay gone) and nine browser tests in
      `report-chrome.spec.mjs` (toast placement at three viewports, the
      longest notice's width and coverage at two, the wizard footer, the
      clip band's aspect, the gallery borders), each proven red with only
      its fix neutered. Browser-checked at 390 and 1280.

    **Batch 3, performance, infrastructure, backend.**
    - ~~`pages.yml` ~42 uploads `path: .` after `npm ci`: a 168MB artifact for
      an 11MB site, with `node_modules`, tests, docs and migrations public.
      Build a `_site/`. Keep `supabase/functions/_shared/telemetryEvents.js`
      in it (fetched at boot).~~ **Done in #160.** `scripts/build-site.sh`
      copies the seven top-level pages and the six asset directories a
      browser fetches (`assets`, `css`, `data`, `js`, `media`, `vendor`)
      plus the one file outside them a browser import reaches at boot
      (`js/telemetry.js` imports `../supabase/functions/_shared/telemetryEvents.js`
      by that relative path, so the built site keeps it at the same path);
      `pages.yml` runs it and uploads `_site` rather than `.`.
      `tests/deploy-artifact.test.mjs` runs the real script into a temp
      directory and reads what came out, rather than pattern-matching the
      workflow text, so a script and workflow that drifted apart would still
      fail it; each of its three assertions proven red by neutering the
      workflow step and, separately, the script's own copy list.
    - ~~Inline `tokens.css` and `base.css`, load the other four async: measured
      FCP 1116 to 488ms and LCP 1476 to 496ms on a throttled phone. Do NOT
      concatenate and do NOT `modulepreload` (both measured worse).~~ **Done
      in #161.** The source pages keep separate `<link>` tags (unchanged for
      anyone editing styles), wrapped in `<!-- critical-css:start/end -->`
      markers; `scripts/inline-critical-css.mjs`, run by `build-site.sh`
      after the copy, inlines whatever the markers bracket into one
      `<style>` and swaps every stylesheet link after them to the standard
      preload-as-style pattern with a `<noscript>` fallback. One bug caught
      before it shipped: `tokens.css`'s `url(../vendor/fonts/...)` is
      relative to `css/`, where the `<link>` used to live; inlined verbatim
      at the page root the same string would have pointed one directory
      above the site, a font 404 no unit test would have caught, only a
      real browser load. Every `url()` is rebased to the page. Verified by
      building `_site` and loading it in a real browser at 390 and 1280:
      zero console errors, zero failed requests, `font-family` resolves to
      Archivo. `tests/inline-critical-css.test.mjs` builds a throwaway site
      directory and reads what the transform produced rather than
      pattern-matching source; each of its assertions (both stylesheets
      inlined, the url rebase, the async swap, `run()` touching only
      `.html` files) proven red by neutering that one behaviour alone.
    - ~~Eager JS is 41 modules and 216KB gzipped; 15 modules and 56KB is
      reachable: `main.js` and `router.js` import every screen for window
      shims. Make them async and take `plan.js` off boot. Cut the whole
      frontier, not one module.~~ **Partly done in #162, and the rest is
      not a `main.js` fix.** Walking the real static import graph (a small
      script, not a guess: every non-dynamic `import ... from` edge,
      transitively, from a set of roots) found that `main.js`'s own
      eager imports mostly cost nothing to defer, because they were
      already forced in from somewhere else on the mandatory boot path:
      `results.js`, `db.js` and `plan.js` are imported by `landing.js`
      itself (the sample-plan demo), and `account.js`/`dashboard.js` by
      `router.js`; `planExport.js` comes in through `save.js`, which
      `buildAll()` already builds at startup. Deferring any of *those* in
      `main.js` would have changed nothing a browser could measure. Only
      two modules had no other path in: `screens/viewer3d.js` (three.js-backed,
      the single biggest chunk in the app) and `screens/products.js`,
      both imported nowhere but `main.js`. Both are dynamic-imported on
      first use now, the same pattern `router.js` already used to dispose
      the 3D view on exit. `tests/e2e/startup-weight.spec.mjs` gained two
      tests reading the actual network requests (not the module graph, the
      same reasoning its existing tests already give for why): neither
      file is fetched before its screen is opened. Each proven red by
      restoring the eager import, then green again with a diff against a
      backed-up `main.js`, never `git checkout`. Full e2e suite run
      (284 passed, 1 pre-existing skip) since the change touches every
      onclick path to the 3D view and the product library.

      **The 41-to-15 number needs `landing.js`, `router.js`, `save.js` and
      `customize.js` touched too, not `main.js` again.** Those four already
      statically import `results.js`/`db.js`/`plan.js`/`account.js`/
      `dashboard.js`/`planExport.js` for their own use, not for window
      shims — deferring those is the same shape of problem the 09-02
      session left open for `personalize.js`/`setupStructure.js` ("untangling
      that graph... a session of its own"), and it is that session's problem
      too: `wizard-data.js` (72KB) and `personalize.js`/`setupStructure.js`
      (65KB+54KB) are still eager because `data.js`/`wizard-data.js` import
      them, and `buildAll()` needs `wizard.js`, which needs `wizard-data.js`.
      Whoever picks this up next: measure with a real graph walk before
      changing anything, the way this session did — the review's "15
      modules" undercounts what `buildAll()` alone requires. `wizard.js`'s
      own closure is 34 modules and 564KB raw by itself, because
      `wizard-data.js` pulls in `personalize.js` and `setupStructure.js`
      (120KB together) and `wizard.js` itself statically imports
      `results.js`, `db.js` and `router.js` directly, not just through
      `main.js`. The app is one tightly coupled graph from very close to
      the landing page onward; reaching anything near 56KB means deciding
      which of the wizard's own screens can defer which of the others, not
      trimming what `main.js` hands to `window`.
    - ~~The 3D rAF loop never idles (`js/three/scene.js` ~974-981). Render on
      controls change.~~ **Done in #163.** `requestFrame()`/`renderFrame()`
      replace the always-on loop: a frame is scheduled only by OrbitControls'
      own `change` event (which keeps firing from inside its own `update()`
      through a drag's damping decay, then stops on its own) or by whatever
      moved the scene without moving the camera — `reflow()`, `setSize()`,
      `setZoneLabels()` each call it directly, and every pointer/keyboard
      handler in `interact.js` is wrapped so a future interaction cannot
      forget to ask for a frame. `spotlightShelf()`'s hover highlight
      (`js/screens/viewer3d.js`) was the one direct scene mutation outside
      those three functions and needed its own call.

      **Two things only a real browser load caught, in order.** First,
      `let raf=0, disposed=false;` sat textually inside the render-loop
      section, after `reflow()`'s single startup call — a `let` referenced
      before its own declaration line executes throws (temporal dead zone),
      even though the function closing over it is only *called* later, so
      the very first open of the 3D view threw and 52 e2e tests across the
      viewer3d suites failed with the view never rendering at all. Moving
      the declaration to the top of `buildScene()`, before anything that
      can call `requestRender()`, fixed it; a unit test cannot see this
      class of bug because it is about *when* a closure is entered, not
      what it returns. Second, `saveArrangement`/`openViewer3d` becoming
      dynamic-imported in #162 means the click handler is now a promise
      Playwright's `.click()` does not wait on; two `three-editor.spec.mjs`
      tests that read `state.arrangement` immediately after clicking Save
      raced it and had been intermittently green since #162 merged. Fixed
      by waiting for the "Arrangement saved" toast, the same signal a
      person reads the save from, before reading state — the honest fix,
      since a real Save click has the same race and nothing is owed a
      synchronous read.

      **A genuine, not a fixable, tail:** OrbitControls fires `change` at a
      roughly constant rate for as long as frame-to-frame camera movement
      is above its own fixed epsilon (not exposed as a public option), then
      stops outright rather than tapering off. Measured on this scene's
      scale — an 84-inch cabinet, camera distance over 100 world units — a
      single orbit's damping kept firing `change` (and therefore rendering)
      for 5 to 6 real seconds after the pointer was released, not the
      sub-second settle a smaller scene would show. That is inherent to
      OrbitControls' EPS constant interacting with absolute world scale,
      not something this fix introduced or can tune away without forking
      the vendored library; `tests/e2e/viewer3d-render-on-demand.spec.mjs`
      waits it out (up to 8s) rather than asserting a settle time this
      scene cannot meet. New assertions proven red two ways: reverting the
      loop to always-render (idle and settle-time tests both failed, as
      expected) and reverting the `let` hoist alone (the whole viewer3d
      suite failed on the TDZ throw, confirming that bug's blast radius
      before the fix).
    - ~~`js/three/layouts/index.js` loads 14 builders to use one: thunk map.~~
      **Measured, not done, and recorded so nobody re-tries this without the
      finding.** The 14 files are 54KB combined, largest 6.2KB — a thunk map
      would save at most that, on a chunk `js/three/scene.js` already loads
      lazily (batch 3.3, PR #162), only when someone opens the 3D view, with
      a loading state shown. There is no critical-path win here. What a
      thunk map costs: `buildScene()` is synchronous today and 7 e2e spec
      files call it directly and synchronously (`const view=buildScene(...)`,
      no `await`, 16 call sites total counting `viewer3d.js`) — making the
      builder lookup lazy means making `buildScene()` async, which means
      touching all 16, in a codebase where the last two async conversions
      this session (#162's window shims, this session's own render-on-demand
      work) each shipped one real bug caught only by a browser load. A KB-scale
      win on a non-blocking chunk was not worth a third attempt at that class
      of change. Left alone on purpose, the same shape of decision as the
      personalize.js/setupStructure.js tangle two sessions back.
    - ~~The italic woff2 (39KB) loads eagerly on the landing page: static 400
      instance, or synthesize.~~ **Done in #164.** The second `@font-face`
      (Archivo italic, the full 100-900 variable weight range, 39KB) is
      gone from `css/tokens.css`, and the now-unreferenced font file with
      it. It loaded eagerly because three `<em>` captions in the landing
      page's "What you get" section ("Fits a 14&Prime; shelf", "Nothing to
      buy") are in `index.html`'s static markup, present at parse time —
      font loading isn't viewport-gated, so a matching `@font-face` fetches
      regardless of whether the element is above the fold. Browsers
      synthesize italic from the upright face by default
      (`font-synthesis:style`) whenever no matching italic face exists, so
      dropping the second face costs a faux slant on those captions and on
      the two other places `font-style:italic` is used (an empty-cart note,
      an empty rail state) — confirmed at 390 and 1280, indistinguishable
      at this size. `tests/e2e/startup-weight.spec.mjs` gained an assertion
      reading the network for the italic file's name, proven red by
      restoring the `@font-face` (and the file, from git history, since a
      neutered test needs the request to actually be servable) and green
      again after both were removed a second time.
    - ~~Edge functions parse the body before auth and rate limiting
      (`_shared/body.js` ~20): check `Content-Length` first. The global
      breakers (`render-after` 100/day) are a cheap denial of service; exempt
      signed-in users. EXIF and GPS are kept (`js/db.js` ~170; the upload
      canvas blob strips them). Upstream error text is returned
      (`analyze-space/index.ts` ~361, ~425). `plan_meta` is not allowlisted
      (`sharePayload.js` ~352). `escapeHtml` misses `'` (`js/ui.js` ~18) and
      `products.js` ~55 has a duplicate escaper.~~ **Done in #165.**
      `readJsonObject` (`_shared/body.js`) now rejects a body over 16MB by
      `Content-Length` before calling `req.json()`, so an oversized upload is
      refused without paying the parse cost. `render-after` and
      `analyze-space` still cap signed-in callers at their per-user limits
      (3/hr + 5/day, 5/hr) but no longer also count them against the
      anonymous-only global breaker (100/day and 300/day respectively) - that
      breaker exists to stop an anonymous flood, and was capable of locking
      out every signed-in user once it filled. `js/db.js`'s `pendingMedia()`
      now runs every photo through a canvas re-encode
      (`stripPhotoMetadata()`) before it ever reaches state or upload, which
      strips EXIF (including GPS) the same way the existing render-prep
      canvas already did incidentally; proven with a hand-built JPEG carrying
      a real EXIF/GPS APP1 segment that a real browser decodes, then
      confirmed the uploaded blob no longer contains it.
      `analyze-space/index.ts`'s failure response no longer forwards
      `result.detail` (the upstream model's own error text) to the client;
      it's still logged server-side via `console.error`. `sharePayload.js`
      now allowlists `plan_meta` to `model`, `source` and `analyzedAt` the
      same way the rest of the shared-space payload is allowlisted, so a
      field like a request ID never rides along in a share link.
      `escapeHtml` (`js/ui.js`) now escapes `'` as `&#39;` alongside the other
      four characters, and `products.js`'s duplicate `esc()` is gone in favor
      of importing the shared one.
    - ~~No retention purge for `usage_events` or `telemetry_events`. The
      after-render is stored without a save (`results.js` ~503).~~ **Done in
      #167.** `0011_event_retention.sql` adds `purge_old_events()`
      (`security definer`, EXECUTE revoked from anon/authenticated, granted
      only to `service_role`) and schedules it with `pg_cron` — installed
      into the `extensions` schema rather than `public`, so this doesn't
      hand batch 3.9 a second pg_net-shaped advisor finding to fix.
      `usage_events` rows older than 30 days are purged (nothing anywhere
      reads one older than a day: `check_and_log_usage` only ever looks back
      an hour or a day); `telemetry_events` gets 180 days, since it feeds the
      trend reports in `supabase/queries/telemetry.sql` rather than a
      rate-limit window. Applied to the live project (along with the
      still-pending #159 and #168 migrations) once Supabase MCP access came
      back mid-session; `pg_cron` installed cleanly into `extensions`.
      Separately, `render-after` (~line 118) was writing its output to
      storage and to the space's `after_render_path` as soon as a `spaceId`
      was present — and `autoSaveSpace` creates that id, silently, the
      moment a plan exists, well before any explicit save. That's a real gap
      against the privacy page's specific promise: "they are uploaded to
      your private account only when you save or share the space. The plan
      itself saves automatically, your photos do not." The after-render now
      only persists when `space_media` already has a `photo`/`frame` row for
      that space — the same signal `coverUrl` already treats as "this
      space's before photo was explicitly saved" — so a preview generated
      before ever saving still renders and displays, it just isn't written
      to storage until a real save (or share, which saves first) has
      happened.
    - ~~Supabase advisors: revoke EXECUTE on `handle_new_user()` from anon and
      authenticated; move `pg_net` out of public; wrap `auth.uid()` in
      `(select ...)` in five policies; index the `user_id` foreign keys on
      `feedback`, `invite_requests` and `space_media`.~~ **Done in #168** —
      half of it, anyway. Two of these four turned out to already be closed:
      `0009_touch_updated_at_search_path.sql`'s own comment records that the
      EXECUTE grant is a false positive (measured by calling
      `handle_new_user()` directly — it fails closed on its `trigger` return
      type) and that moving `pg_net` out of `public` is a Supabase default,
      not a choice made here, invasive for no gain. Rebuilding either would
      have been undoing a decision this repo already made and wrote down,
      not fixing a gap — the exact case CLAUDE.md warns about. The other two
      were real: `0012_advisor_rls_and_indexes.sql` wraps `auth.uid()` in
      `(select ...)` on the three `profiles` policies and one each on
      `spaces` and `space_media` (a bare `auth.uid()` re-evaluates per row;
      wrapped, the planner evaluates it once per query), and indexes
      `feedback.user_id`, `invite_requests.user_id` and
      `space_media.user_id`, none of which had one. Applied and verified via
      `get_advisors`: the `auth_rls_initplan` findings are gone, the three
      new indexes show up only as INFO-level `unused_index` (expected — they
      are brand new), and `pg_net`/`handle_new_user` are unchanged, exactly
      as intended.
    - ~~CI: add `permissions: contents: read` to the test, supabase-functions
      and canary workflows; pin actions to SHAs. Check the hosted OTP expiry
      and captcha (`config.toml` says 1h, no captcha).~~ **Partly done in
      #169.** `test.yml`, `supabase-functions.yml` and
      `model-path-canary.yml` now declare `contents: read` explicitly
      (`pages.yml` already had it, for the `pages`/`id-token` write its
      deploy needs). Pinning the six third-party actions in use
      (`actions/checkout`, `setup-node`, `upload-artifact`,
      `configure-pages`, `upload-pages-artifact`, `deploy-pages`) to commit
      SHAs is still open: this session's GitHub access is scoped to this one
      repository, so there is no way from here to resolve `@v4`/`@v5` to the
      commit they currently point at, and a guessed SHA is worse than an
      unpinned tag. Left for a session with broader GitHub read access (or a
      human, from the Actions tab's "pin to SHA" affordance).
      The OTP expiry/captcha check resolved itself: `get_advisors` carries a
      dedicated `auth_otp_long_expiry` finding when the hosted expiry exceeds
      Supabase's own 1-hour recommendation, and none appeared in this
      session's scan, so the hosted project is already within it. Captcha
      stays off for the same reason 0009 gives for leaked-password
      protection: sign-in is magic-code only, so there is no password form
      for a bot to hammer; a captcha would guard the OTP-request endpoint
      against spam, but that is already rate-limited
      (`auth.rate_limit.sign_in_sign_ups`/`token_verifications`), and adding
      a third-party captcha provider is a product call, not a code fix, so
      it is left to whoever owns that account.
    - ~~SEO: canonical is `scmsolutions.org/tidymaps` while the README says
      github.io and CORS lists tidymaps.ai (did not resolve). Add `robots.txt`,
      `sitemap.xml`, JSON-LD, `apple-touch-icon`, `<meta name=color-scheme>`;
      unify `theme-color`; the title is 72 chars.~~ **Partly done in #170.**
      `robots.txt` and `sitemap.xml` now ship at the site root (with
      `build-site.sh` copying them into the deploy artifact); every page
      declares `<meta name="color-scheme" content="light dark">`; and
      `theme-color` is unified to `#b5522f` across all seven pages (six
      subpages were drifting on `#c94a2e`, only `index.html` matched the
      `--spot` design token). The README's Live site URL is updated to
      `scmsolutions.org/tidymaps` to match the canonical.
      Deliberately left for a later pass: JSON-LD (requires structured
      product-metadata decisions), `apple-touch-icon` (needs a new PNG
      binary asset that doesn't exist in the repo), and the title's
      72-char length (copywriting call). The `tidymaps.ai` entry in
      `supabase/functions/_shared/cors.ts` came out in this session: DNS
      confirmed the name does not resolve (Node's `getaddrinfo` returns
      `ENOTFOUND` while `anthropic.com` and `scmsolutions.org` resolve
      fine from the same sandbox), so the two allowlist entries went with
      it. Grepped for other references first — none in canonical URLs,
      sitemap, README, or CI, so nothing else needed to change. The
      change is a real production behavior shift, same shape as the
      port-3000 note in Backend/deploy state: any browser reaching
      `https://tidymaps.ai` through a stale cache or `/etc/hosts` now
      gets its preflight redirected to the fallback origin and its
      telemetry drops on the floor. Merged-not-deployed until item 11
      rotates the deploy token.
    - ~~Dead work: `plan.features` is requested, normalized and shared but
      rendered nowhere; household counts are never read; `detected` is never
      set in production; `hero-3d.webp` is declared 522x700 and the file is
      1100x858.~~ **Done, mostly not the way the entry said.** The hero
      image's declared dimensions moved to 1100x858 in #170. `plan.features`
      is removed in this PR (see below). The other two flags in this
      entry were wrong on their facts and are left as is:

      - **`plan.features` (dead, removed).** Traced across every layer
        (prompt → schema → client normalize → setup-structure filter →
        results.js → share allowlist → share redact → state defaults →
        wizard round-trip → 16 demo scenarios → 5 tests); nothing rendered
        it. Removed symmetrically to keep the CLAUDE.md "validator never
        stricter than its own prompt" rule intact — a new test in
        `tests/plan-schema.test.mjs` (`plan.features is removed
        symmetrically from the prompt and the schema`) pins the two sides
        to move together, so a future re-introduction on one side without
        the other fails CI. Older `spaces` rows still carry
        `plan.features` in their stored JSONB; the schema now silently
        strips it (zod's default is drop-unknown, not reject) and
        `sharePayload.js`'s allowlist means it never travels through a
        share link either. `DEMO_FEATURES` in `js/data.js` (a fallback for
        the empty-state render that no longer exists) came out with it.
      - **Household counts were NOT dead.** `state.household.kidCount` is
        read by the report's masthead chip (`results.js ~107-108`), by
        the share redaction (`sharePayload.js ~158` gates child-word
        redaction on `kidCount > 0`) and by `householdAnswered` in
        `js/wizard-data.js`. `petCount` is read by the wizard steppers
        and the masthead chip. The audit's own trace records this. Only
        the NESTED duplicates at `js/plan.js:247,249`
        (`plan.household.kids.count`/`pets.count`, built for the analysis
        context) have no named reader, but they still reach the model as
        part of the JSON blob in `promptContext.js:80-82`, and the CLAUDE.md
        rule "removing a field the prompt still consumes" applies to the
        blob just as much as to a named field. Left alone.
      - **`detected` was NOT dead either.** The `state.detected` field
        is set by `runLocalDetection()` (`js/screens/capture.js:137`) on
        the no-backend path, rendered as chips at capture and contents
        (`#photo-detected-chips`, `#contents-detected`), injected into
        the prompt when set (`promptContext.js:53-55`), and round-tripped
        in the prefs blob. The entry's claim "never set in production"
        conflates "no telemetry evidence of it firing" with "the code
        path doesn't run", and the first proves nothing about the
        second — this codebase learned the same lesson under
        "Correcting the previous refresh, because it was load-bearing
        and wrong". Left alone.
    - Funnel: zero telemetry rows in 14 days, one real AI space on 09-08. Open
      item 6 stands. ~~There is no in-app opt-out, and `cookies.html`'s
      no-banner reasoning ignores localStorage.~~ **Done in #NNN.**
      `cookies.html` now hosts a one-tap opt-out at
      `#turning-the-counter-on-and-off` that writes `tidymap_optout_v1='off'`
      and clears `tidymap_anon_v1` in the same call; `js/telemetry.js` reads
      the same key through the new shared `js/optout.js` module, so the two
      agree by import rather than by string. `optedOut()` gains it as the
      last check — DNT/GPC read first because a browser-level signal is a
      stronger consent gesture than a page toggle, and it is what
      `telemetryStatus()` reports so a GPC browser's silence still names GPC
      and not the flag. The no-banner section now calls the anonymous counter
      the one non-essential item on the list and hosts the toggle inline; the
      paragraph and its code moved together. `privacy.html` points at the
      same anchor. A visitor whose browser sends GPC sees no button, only a
      status line naming GPC, so the page never offers control it cannot
      honor. Six unit assertions in `tests/optout.test.mjs` and three
      browser tests in `tests/e2e/telemetry-optout.spec.mjs`, each proven
      red by neutering only its own behaviour: `isOptedOut()` returning
      false constant; `setOptedOut` no longer clearing `ANON_KEY`; the new
      branch removed from `telemetryStatus`; the ordering reversed; and in
      the browser, `optedOut()`'s read removed, which produces a real
      `track-events` POST the leak assertion names. One trap caught only in
      a real browser: `.btn`'s `display:inline-flex` beats the UA
      `[hidden]{display:none}` on specificity, so
      `.optout .btn[hidden]{display:none}` sits in `css/legal.css` scoped
      to the toggle. Backend/deploy state now names the opt-out alongside
      DNT/GPC.

### Waiting on traffic

6. **The funnel is switched off, not quiet — and this is now actionable, not a
   waiting item.** `plan_rated` and `feedback_submitted` have never had a row,
   `plan_created` last fired 2026-07-30, and `telemetry_events` has had nothing
   at all since 2026-08-04 despite real sessions on 08-18, 08-19 and 08-20.
   Production health #8 rules out the CORS origin by measurement — no
   `track-events` usage rows on those days means no request left the browser —
   so `optedOut()` is the remaining candidate. **Do this first:** open the site
   in the browser those sessions used and read `telemetryStatus()` on `window`;
   it names DNT or GPC in one line. Brave, DuckDuckGo and Firefox send GPC by
   default. Then read `plan_rated` before `feedback_submitted`: the first is one
   tap on the report, the second needs three more screens.

### Waiting on business input

7. **#5 products:** SKU curation and real affiliate IDs, then flip the flags in
   `js/affiliates.js`. Every entry is still an empty string, so all 30 catalog
   products link plain and no disclosure renders.

### Known gap, no owner

8. **Every memory store about this project drifts, this one included.** This
   file went 14 days and 45 PRs stale once, and its headline framing actively
   misled (see the correction at the top). If you are reading this more than a
   few merges after the refresh date, distrust the specifics and re-derive from
   `git log` and the tables before acting on them.

   The vault and Notion copies drift *worse*, because nothing merges into them:
   on 08-27 the venture page was six weeks and a hundred PRs behind, and the
   3D-viewer handoff still listed four shipped ports as next actions. They were
   corrected that day and each now points here rather than restating state, so
   there is one place to update instead of five. Keep it that way — a second
   copy of the status is a second thing to be wrong.

## Session conventions

Develop on the session's own `claude/*` branch, reset from `origin/main` after
each merge (never stack on merged history), open draft PRs, subscribe to PR
activity, and re-check open PRs on a timer until they merge.

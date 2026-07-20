# TidyMap engineering handoff — session summary (July 2026)

A durable snapshot of what shipped, how it fits together, what's deployed,
and what's still open — so a fresh session (or human) can continue without
re-deriving anything. Written at the close of the session that executed the
original 8-item engineering handoff.

## Product state in one paragraph

Static ES-module site (no build step) served from GitHub Pages, with a
Supabase backend (project `jwubrtaacveavbkosgtf`): Postgres + RLS, magic-code
auth, private `space-media` storage, and Deno edge functions that hold the AI
keys (BYOK was removed; any `tidymap_key` in localStorage is scrubbed at
startup). The wizard follows the Claude Design 12-step contract: `landing →
space (room) → area → setup → measure → capture (photos) → household →
contents → goals → style → effort → shopping → review → loading → results →
customize → save → feedback → done` (`js/router.js FLOW`; step data lives in
`js/wizard-data.js`, step rendering in `js/screens/wizard.js`), plus a
dashboard, a 3D viewer, and a read-only shared-plan view.

## Scorecard: the original 8 handoff items

| # | Item | Status | PR |
|---|------|--------|----|
| 1 | Plan generation engine | ✅ shipped | #19 |
| 2 | Vision detection hardening | ✅ shipped | #20 |
| 3 | Imagery library pipeline | ✅ shipped (art itself pending, by design) | #20 |
| 4 | Step-media pipeline | ✅ shipped (clips pending, by design) | #21 |
| 5 | Products | ⏸ code done earlier; blocked on business inputs | — |
| 6 | Persistence: share links + photo promise | ✅ shipped + deployed | #23 |
| 7 | Automated QA (Playwright in CI) | ✅ shipped | #22 |
| 8 | Telemetry + feedback loop | ✅ shipped + deployed | #24 |

Post-handoff additions: plan personalization (#25) and the PR #18 conflict
resolution (landing product visuals). All eight PRs are merged; `main` is the
single source of truth.

### #1 Plan engine (PR #19)
`supabase/functions/analyze-space/index.ts` validates model output against a
zod schema (`_shared/planSchema.js`) with product invariants (categories only
from user selection, goal-driven steps never dropped, kid safety only when
kids present, effort caps, zero purchases on "use what I have"). One retry
with validation errors appended; second failure falls back to the
deterministic scenario engine. Fixture tests in `tests/`.

### #2 Vision hardening (PR #20)
- Prompt injection: `_shared/promptContext.js` wraps ALL user-typed context
  in a `<user_context>` block behind a standing guard instruction;
  `sanitizeUntrusted` strips control chars, defangs the delimiter token, caps
  length. The system prompt also declares text visible in photos to be
  objects, never instructions. Stored-XSS escaping in `results.js` untouched.
- Photo quality: `js/imageQuality.js` (brightness + variance-of-Laplacian)
  drives advisory "Too dark"/"Blurry" badges in `js/screens/capture.js`.
  Advisory only — user keeps flagged photos if they want.

### #3 Imagery pipeline (PR #20, refined in #18)
`data/images.json` is the source of truth for every keyed image (file, alt,
license, `ready|pending`). `js/images.js hydrateImages()` fills ready images;
pending/unknown keys are left to each slot's declarative `onerror` fallback.
`tests/images.test.mjs` fails CI on undeclared keys, missing ready files,
stray pending files, missing alt/license, or stock/CDN hotlinks. The two real
photos (`hero-home`, `story-before`) remain `pending` — design shoots them
per `docs/asset-plan.md`; flipping status to `ready` is the whole ship step.
Since #18 the hero has a two-stage fallback: photo → `hero-3d.png` product
stand-in + caption → text-only collapse.

### #4 Step-media pipeline (PR #21)
Clips are keyed `{action}-{motif}-{glyph}`: 13 `STEP_ART` scene types × 4
furniture motifs × 12 item glyphs. `js/stepMedia.js` owns the vocabulary
(`classifyAction` moved out of results.js so key and fallback can't drift),
`data/step-media.json` declares produced clips (empty today), and
`hydrateStepMedia()` lazy-loads `<video>` in-view for `ready` keys only
(mp4/webm native; Lottie `.json` waits for a vendored player). The inline
animated SVGs are both the spec each clip must match and the permanent
fallback. Guard: `tests/step-media.test.mjs`.

### #5 Products — the one open item
Catalog (`data/catalog.json`), dimension-fit matching (`js/catalog.js`), and
feature-flagged affiliate tags (`js/affiliates.js`) already exist. Blocked on
business, not code: deeper SKU curation and real affiliate/associate IDs.
Opt-in live link checker: `npm run check:links` (not in CI — retailer
bot-blocking false-fails from datacenter IPs).

### #6 Share links + photo promise (PR #23) — DEPLOYED
- Migration `0005_sharing.sql`: unique nullable `spaces.share_id`.
- `get-shared-space` edge function (live, v1): rate-limited service-role
  lookup; response passes through the `_shared/sharePayload.js` **allowlist**
  (plan/zones/steps/dims only — household, progress, shopping, media, ids can
  never leak; new fields are excluded by default).
- Owner UX: "Share with family / roommate" on the save screen saves, mints,
  and copies `?share=<uuid>`. Nulling `share_id` revokes instantly.
- Visitor UX: read-only results view (banner, `data-owner-only` actions
  hidden, `state.shareView` blocks the guest-draft writer).
- Photo promise: guest drafts never serialize media (pinned by
  `tests/guest-privacy.test.mjs`); `clearGuestMedia()` drops in-memory copies
  at the done screen for signed-out users. `privacy.html` documents both.

### #7 Automated QA (PR #22)
`tests/e2e/wizard-matrix.spec.mjs` drives the real UI landing→plan for all 14
spaces (demo capture): masthead matches space, map/steps/tags render, media
keys valid, measurements round-trip into the 3D status line, zero console
errors/failed local requests; kid/no-kid safety variants; product-link shape.
`.github/workflows/test.yml` runs `unit` + `e2e` on every PR (traces uploaded
on failure). Day one it caught two real bugs: base scenarios shipped
kid-phrased safety notes unconditionally, and the wizard's `'no'` string was
truthy "kids present" — both fixed with regression tests.

### #8 Telemetry (PR #24) — DEPLOYED
- Migration `0006_telemetry.sql`: `telemetry_events` (RLS, no policies).
- `track-events` edge function (live, v1) re-sanitizes every batch against
  `_shared/telemetryEvents.js`: 8-event allowlist, flat primitive props,
  80-char strings, 1KB/event, 25/batch. Client `js/telemetry.js`: random
  localStorage `anon_id` (`tidymap_anon_v1`), debounce+flush-on-hide
  batching, honors DNT/GPC, disables under `navigator.webdriver` (CI emits
  nothing), fails silently.
- **The key business question is one query**: per `anon_id`, does
  `max(step_checked.props.checkedCount) >= 3` correlate with
  `feedback_submitted.props.useful = 'I would pay for this'`? Events:
  `screen_viewed, plan_created, step_checked, product_clicked,
  feedback_submitted, share_link_created, shared_plan_viewed,
  after_render_requested`.

### Personalization (PR #25, post-handoff)
`js/personalize.js` makes the deterministic path honor EVERY wizard answer
(the AI path already does, server-side — do not double-apply):
- `applyAnswers(rawPlan, answers)` runs inside `getDemoScenario` (called with
  `buildAnalysisContext()` from `js/screens/loading.js`). Budget bands ($0 →
  zero purchases), all 13 prefs, all 7 toggles, dims advice, then effort
  sizes the checklist (Quick 6 / 1-hour 8 / Weekend 10 / Full 13 —
  `EFFORT_STEPS`). Core pattern: `ensureCitedStep` — cite the user's answer
  verbatim on an existing matching step, add one only if nothing covers it;
  `_p`-flagged and safety steps survive trimming.
- `applyCategoryEdits(normalizedPlan, cats)` runs on BOTH paths when leaving
  review (`syncCategoriesToResults` in `js/screens/results.js`): removed
  categories are scrubbed from zone items (stem match), zone labels (join
  segments), and rationale sentences (multi-word categories via
  plural-tolerant phrase regexes); added ones land in exactly one zone.

## Architecture crib sheet

- **Two plan shapes.** Raw (AI JSON / scenario output: `steps[{task,time,
  why}]`, `map[{level,zone,icon,why,eye,shelfIndex,safety,items}]`,
  `productNeeds`) → `normalizeAi()` in `js/plan.js` → normalized UI shape
  (`steps[{t,m,w}]`, `map[{lv,zone,ic,why,...}]`). `applyAnswers` is raw;
  `applyCategoryEdits` is normalized. User dims/shelf count always win in
  `normalizeGeometry`.
- **Two plan paths.** AI (`analyze-space`, invariants server-side) and
  deterministic (`js/demo-scenarios.js getDemoScenario(space, goal,
  household, answers)`), used for demo capture, no backend, and AI failure.
  `runDemo()` on the landing passes no answers on purpose (pure sample).
- **State.** `js/state.js`. Guest draft `tidymap_draft_v2` never contains
  media; `state.shareView` blocks the draft writer; `prepareDemoPlanState`
  is the canonical reset.
- **Wizard answers.** `prefs` (Set of 13), `budget`, `effort`, `detail_*`
  toggle keys on state, `dims{w_in,h_in,d_in,shelves}`, `household`
  (`present` is `'yes'|'no'|null` STRINGS — never truthiness-check),
  `cats` (authoritative after review edits).

## Backend / deploy state (as of this session)

- Migrations applied: 0001 init, 0002 storage, 0003 feedback,
  0004 invite_requests, 0005 sharing, 0006 telemetry.
- Edge functions live: `analyze-space`, `render-after`,
  `get-shared-space` (v1), `track-events` (v1). All verify_jwt (anon key
  passes); CORS allowlist in `_shared/cors.ts` (Pages, scmsolutions.org,
  tidymaps.ai, localhost:8000/8123).
- Deploys were done via the Supabase MCP tools (`apply_migration`,
  `deploy_edge_function` with the `_shared/*` files bundled alongside the
  entrypoint). Note: the CCR sandbox's network policy blocks direct HTTPS to
  `supabase.co` — use MCP, not curl, and don't mistake that 403 for an outage.

## Testing & verification

- `npm test` — 116 unit/contract tests (Node built-in runner,
  `tests/*.test.mjs`).
- `npx playwright test` — 19 E2E (`tests/e2e/`, config
  `playwright.config.mjs`, python http.server on :8123). Locally set
  `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` if the
  Playwright-managed browser isn't installed.
- CI: `.github/workflows/test.yml` on every PR. Pages deploy: `pages.yml` on
  push to main.
- Session habit that paid off: browser smoke-test every user-facing change
  (Playwright against `python3 -m http.server`), and mock edge functions
  with `page.route('**/functions/v1/...')` when the backend isn't reachable.

## Open items / next actions

1. **User to-do:** live share-link round trip (mint on a saved plan → open
   `?share=` link signed-out; expect banner + plan, no household/photos).
2. **#5 products:** SKU curation + real affiliate IDs (business), then flip
   `js/affiliates.js` flags.
3. **Media production (design-owned):** shoot the two landing photos; produce
   step clips against the SVG scene specs. Both ship by dropping a file and
   flipping a manifest entry to `ready` — CI guards the rest.
4. **Telemetry payoff:** after data accrues, write the pay-for-it SQL /
   small dashboard (join described under #8 above).
5. **Session conventions:** develop on `claude/tidymap-engineering-handoff-
   0a2ve4`, reset it from `origin/main` after each merge (never stack on
   merged history), draft PRs, subscribe to PR activity, hourly `send_later`
   check-ins while a PR is open (cancel on merge).

# TidyMap asset plan — real photography & product screenshots

The landing page is designed around real assets, not illustrations. Product
screenshots are generated from the app itself (see below). The photographs
must be shot by us — stock photography would defeat the point.

## Imagery manifest (source of truth)

Every keyed image the app shows is declared in `data/images.json` with its
file, alt text, license/provenance, and a `status` of `ready` or `pending`.
The app consumes it through `js/images.js` (`hydrateImages` fills ready
images from the manifest; pending slots fall back to the design's `onerror`
collapse). The build-time guard in `tests/images.test.mjs` runs in CI and
fails the build if a referenced key is undeclared, a `ready` file is missing
from disk, an entry lacks alt/license, or an external stock/CDN hotlink
creeps back in — so a broken image is caught at build time, never as a
runtime 404.

The guard also runs that check in reverse: a declared key that nothing
references — by `data-img` or by its file path — fails the build too. The
manifest is a shipping contract, not a wish list, and an unreachable entry
reads to the next person as work owed. Keys that are genuinely staged ahead
of their page live in `UNREFERENCED_OK` in that suite, each with a reason.

Workflow to ship a new photo: drop the file at its manifest `file` path, flip
that entry's `status` from `pending` to `ready`, and the guard enforces the
rest. To add a brand-new slot, add a keyed entry and reference it from markup
with `data-img="<key>"`.

## Photo slots on the landing page

The page degrades gracefully while these files are missing. The hero slot
falls back to a real product visual (`assets/product/hero-3d.png`, the sample
plan in the 3D view) with its own caption; the story slot collapses and the
layout reflows. Drop the photo files in and they take over automatically —
no code changes needed, and the fallback caption hides itself.

| File | Where it appears | What to shoot |
|---|---|---|
| `assets/photos/hero-pantry.jpg` | Hero, right side (4:3 crop) | One candid, attainable household space. Real life visible: lunch boxes, kids' water bottles, ordinary bins, a note taped to the wall. Daylight, no staging, no styling. Landscape orientation, at least 1600px wide. |
| `assets/photos/story-pantry-before.jpg` | "A pantry that works before school" (4:5 crop) | The *actual* pantry a plan was made for, photographed exactly as it was submitted — full shelves, mixed categories, bulk bags. Portrait orientation, at least 1000px wide. |

Guidelines for both:

- Shoot a real home (our own, or a consenting early-access household — get
  written permission before publishing).
- No tidying before shooting. The credibility of the page depends on the
  "before" looking like a real Tuesday.
- Natural light, phone camera is fine. Avoid filters and HDR halos.
- Once the photographed household's real plan exists, update the story
  section's plan excerpt and notes to match that household, and re-check the
  time/cost line against what actually happened.

## Wizard cards are illustrated, not photographed

The room, area, and setup cards in the wizard draw line art from
`js/wizard-data.js` (`art()`), and that is the finished design rather than a
stand-in. Do not add photo slots for them.

The wizard was first built expecting photos to replace the line art per card
as they were shot, and seventeen `wiz-*` keys were declared in
`data/images.json` against that plan. The hydration was never wired —
`cardArt()` calls `art()` and never consults the manifest — and in the
meantime the design settled the question the other way:

- `css/components.css` states the rule directly: every room, area, and setup
  card "keeps the same line-art language", over a four-tone tinted canvas with
  a drifting glow behind a transparent SVG. A photograph in that slot covers
  the canvas the tint and glow exist to fill.
- `tests/e2e/wizard-illustration-motion.spec.mjs` pins a contract a photo
  cannot meet: every card across all nine areas must have one detail that
  *moves at rest*, far enough and large enough to read at card size, so the
  option is legible without hovering.

So the seventeen entries were removed (2026-08-04). No file on disk was
deleted and nothing on the site changed — nothing had ever referenced them.
If photography for these cards is ever revisited, it is a design change to the
card system, not a matter of dropping files into place.

## Step-animation clips (motion pipeline)

The plan checklist's step illustrations are inline animated SVG scenes in
`js/screens/results.js` (`STEP_ART`). Those scenes are the spec for produced
motion clips — same staging, same story (unload = items OUT into a box, wipe
= cloth along the surface, and so on).

Produced clips are declared in `data/step-media.json` under the key contract
`{action}-{motif}-{glyph}`:

- **action** — one of the 13 `STEP_ART` scene types
  (`purge|unload|wipe|label|hang|fold|photo|contain|group|moveUp|moveDown|zones|done`)
- **motif** — the furniture the scene is staged on (`shelves|drawers|rail|bench`),
  derived from the chosen space (`js/stepMedia.js: motifForSpace`)
- **glyph** — the item being moved
  (`shoe|hanger|foldedclothes|towel|jar|can|bottle|utensil|tool|tote|plate|bag`)

Files live at `media/steps/{key}.(mp4|webm|json)`. mp4/webm play natively;
`.json` is Lottie and is used only once a player is vendored. Clips lazy-load
when the step scrolls into view, and only when marked `ready` — a slot whose
clip is missing, pending, or fails playback keeps its SVG scene, so nothing
ever renders blank and nothing 404s. `tests/step-media.test.mjs` fails CI on
an out-of-vocabulary key, a ready file missing from disk, or a pending entry
whose file already landed.

Workflow to ship a clip: produce it to match the SVG scene, drop the file at
its key path, declare `{ file, status: "ready", license }` in the manifest.

Since 2026-08-10 production is programmatic: the Remotion project in
`remotion/` ports each scene's CSS keyframes onto a wide stage in the site's
own palette and renders VP9 WebM per key (`node render-steps.mjs`, which also
rebuilds the manifest — see `remotion/README.md`). The produced set is the
demo-matrix union plus every space's default `{motif, glyph}` pair across all
actions; rarer keys keep their SVG scene on purpose. Two consequences to
remember: the clips bake the token palette, so a `tokens.css` palette change
means updating `remotion/src/tokens.ts` and re-rendering with `--force`; and
a new `STEP_ART` scene or vocabulary word needs a matching scene component in
`remotion/src/scenes/` before its clips can exist.

## Product screenshots

Only one is still shown: `assets/product/hero-3d.png`, the sample plan in the
3D viewer, which backs the hero photo as its `onerror` fallback. Regenerate it
after a product change and keep it honest — no retouching beyond cropping.

`plan-map.png`, `plan-steps.png`, `plan-shopping.png`, and
`wizard-household.png` are **not** on the site, and that is deliberate rather
than an oversight. Commit 2265978 replaced them with drawn explainers because
an app screenshot scaled to sit three-across is a picture of text at 6px: it
proves a plan exists without telling anyone what is in one. The real screens
stay one click away behind "View a sample plan". Their manifest entries were
removed on 2026-08-04 for the same reason the wizard's were — a key nothing
references reads as work owed.

The files stay on disk. They are honest captures and cost nothing where they
sit, and a future case for showing a screenshot at readable size (a docs page,
a press kit) should not have to re-shoot them. Anything that does show one
needs a fresh manifest entry, since the reachability guard will otherwise fail
the build.

## Social / OG image

`assets/og.png` (1200×630) is a capture of the live hero. Regenerate whenever
the hero copy or palette changes.

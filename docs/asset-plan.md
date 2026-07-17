# TidyMap asset plan — real photography & product screenshots

The landing page is designed around real assets, not illustrations. Product
screenshots are generated from the app itself (see below). The photographs
must be shot by us — stock photography would defeat the point.

## Photo slots on the landing page

The page degrades gracefully while these files are missing: if an image 404s,
its `onerror` handler collapses the slot and the layout reflows. Drop the
files in and the sections light up — no code changes needed.

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

## Product screenshots

`assets/product/plan-map.png`, `plan-steps.png`, and `plan-shopping.png` are
real screenshots of the sample pantry plan, captured from the running app at
a 920px-wide viewport. To regenerate after a product change:

1. Serve the repo root over HTTP.
2. Load the site, click "View a sample plan".
3. Screenshot the "Where things go" map, the "Step-by-step" chapter, and the
   "Optional purchases" chapter (enable upgrades in the demo).

Keep them honest: no retouching beyond cropping. If the product UI changes,
regenerate rather than letting the landing page drift from reality.

## Social / OG image

`assets/og.png` (1200×630) is a capture of the live hero. Regenerate whenever
the hero copy or palette changes.

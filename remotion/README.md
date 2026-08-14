# Step-clip production (Remotion)

This project renders the plan checklist's motion clips — the produced side of
the pipeline described in `docs/asset-plan.md` ("Step-animation clips"). The
inline animated SVG scenes in `js/screens/results.js` (`STEP_ART`) are the
spec: every composition here ports one scene's CSS-keyframe choreography
(`css/components.css`) onto a wide stage, staged on the furniture motif and
holding the item glyph of its media key.

## Layout

- `src/tokens.ts` — the site's palette (`css/tokens.css`) as constants, per-
  action loop lengths matching the CSS animation durations, easing curves.
  **A palette change in tokens.css means updating this file and re-rendering.**
- `src/Stage.tsx` / `src/motifs.tsx` / `src/glyphs.tsx` — the shared visual
  language: 320×80 stage on the `.step-art` band's surface color, four
  furniture motifs with a geometry API, twelve item glyphs.
- `src/Ambience.tsx` — the contents the story is NOT about: a pale pair of
  items at the far ends of every surface, so a scene is staged in a space
  rather than on empty furniture. Sits outside the x-band the choreographies
  work in; read its header before moving anything.
- `src/scenes/*.tsx` — one choreography per action (all fourteen, `stock`
  included — it was the missing one, and it is the commonest instruction a
  real plan gives), all frame-driven
  (`useCurrentFrame` + `interpolate`; no CSS animation, which Remotion cannot
  render).
- `enumerate-keys.mjs` — which keys to produce: the demo-matrix union plus
  every space's default-pair × all actions (see the header comment).
- `render-steps.mjs` — bundles once, renders each key to
  `../media/steps/{key}.webm` (VP9, opaque `--surface-2` background so
  `object-fit: contain` letterboxing is invisible), then rebuilds the
  `clips` block of `../data/step-media.json`.

## Commands

```sh
npm install            # once
npm run keys           # report the producible key list
npm run render         # render missing clips + update the manifest
node render-steps.mjs --force            # re-render everything (design change)
node render-steps.mjs --only purge-shelves-can,wipe-shelves-bottle
npm run studio         # live-preview compositions while editing scenes
```

A design change to `Stage`, `Ambience`, `motifs` or `glyphs` touches every
clip, so it needs `--force` and a full ~25-minute re-render.

Rendering uses the pre-installed Playwright Chromium
(`/opt/pw-browsers/chromium`, override with `REMOTION_BROWSER`) because the
sandbox blocks Remotion's own browser download.

After rendering, `npm test` at the repo root runs
`tests/step-media.test.mjs`, which fails the build on a manifest entry whose
file is missing, an out-of-vocabulary key, or a pending entry whose file
already landed.

## Design rules the scenes follow

- Loop-safe: frame 0 equals the last frame unless the CSS spec itself pops at
  the loop point (wipe's dust, done's check reset) — then the pop is the spec.
- CSS `animation-delay` staggering becomes a modular phase shift so loops
  stay seamless (see `scenes/purge.tsx`).
- Accents only from the token palette, used the way the spec scene uses them
  (tri-tone bins in purge, honey label tag, primary move arrows…). Items stay
  plain ink; structure is ink-3.
- Every scene must read on every motif: placement goes through
  `itemSpots()` / `MotifGeo`, never hardcoded to one furniture.

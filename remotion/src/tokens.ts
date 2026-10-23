/* Design tokens mirrored from ../../css/tokens.css (The Warm Shelf: sand
   field, the drawings' own line, terracotta accent, butter and sage as the
   supporting fields). The clips are baked video, so the site's CSS variables
   can't reach them: these constants ARE those variables, and a palette change
   in tokens.css means re-rendering. Each one names the variable it copies,
   and tests/remotion-palette.test.mjs fails when a value drifts from it. The
   10-03 warm-up changed tokens.css and nothing here, so every clip played in
   the old stone palette on the new sand band for three weeks.
   Chrome (Remotion's renderer) parses oklch() natively, so the values are
   copied verbatim rather than approximated in hex. */

export const color = {
  bg:        'oklch(0.952 0.02 80)',   // --tint: the .step-art band the clip sits on
  surface3:  'oklch(0.925 0.05 48)',   // --tint-2: dust, recessed panels
  ink:       'oklch(0.27 0.02 40)',    // --ink
  ink2:      'oklch(0.27 0.02 40)',    // --ink-2
  ink3:      'oklch(0.46 0.03 42)',    // --draw: the drawings' line, the main stroke
  line:      'oklch(0.46 0.03 42)',    // --draw: structure prints in the drawing line too
  line2:     'oklch(0.62 0.035 58)',   // --field-line: the floor and the staging items
  primary:   'oklch(0.56 0.13 36)',    // --spot: terracotta accent
  /* --tint-2, not --primary-bg: on the site that is the band's own sand, so an
     accent fill on it would vanish (the middle zone band, the wipe pad). */
  primaryBg: 'oklch(0.925 0.05 48)',   // --tint-2
  honey:     'oklch(0.955 0.06 92)',   // --honey: the butter field
  honey2:    'oklch(0.64 0.12 82)',    // --honey-2: butter's edge
  sage:      'oklch(0.58 0.09 150)',   // --sage
  sageBg:    'oklch(0.94 0.038 150)',  // --sage-bg
} as const;

/* One loop length per action, matching the CSS animation durations of the
   inline STEP_ART scenes (css/components.css) so the produced clip keeps the
   same cadence the design settled on. */
export const FPS = 30;
export const LOOP_SECONDS: Record<string, number> = {
  purge: 3.58, unload: 3.58, wipe: 3.07, label: 3.33, hang: 3.58,
  fold: 3.58, photo: 3.07, contain: 3.33, group: 3.0,
  moveUp: 3.58, moveDown: 3.58, zones: 3.84, stock: 3.58, done: 3.33,
};
export const loopFrames = (action: string) =>
  Math.round((LOOP_SECONDS[action] ?? 3.33) * FPS);

/* The site's motion curves (tokens.css). --ease for UI-ish moves, --ease-physical
   (slight overshoot) for things that represent real objects settling. */
export const EASE: [number, number, number, number] = [0.2, 0.7, 0.3, 1];
export const EASE_OUT: [number, number, number, number] = [0.16, 0.84, 0.28, 1];
export const EASE_PHYSICAL: [number, number, number, number] = [0.34, 1.32, 0.48, 1];

/* Stage geometry. Scenes draw into a 320×80 viewBox rendered at 1280×320,
   so a stroke-width of 2.5 lands at ~3 CSS px once the clip is scaled into
   the ~98px-tall .step-art band — the same visual weight as the 48px inline
   scenes shown at 78px. */
export const VIEW_W = 320;
export const VIEW_H = 80;
export const STROKE = 2.5;
export const FLOOR_Y = 72;
/* How far inside the frame every mark stays, in stage units (check-edges.mjs
   measures it on the rendered clips). */
export const STAGE_MARGIN = 3;

/* Design tokens mirrored from ../../css/tokens.css. The clips are baked
   video, so the site's CSS variables can't reach them — these constants ARE
   those variables, and a palette change in tokens.css means re-rendering.
   Chrome (Remotion's renderer) parses oklch() natively, so the values are
   copied verbatim rather than approximated in hex. */

export const color = {
  bg:        'oklch(0.935 0.007 90)',   // --surface-2: the .step-art band the clip sits on
  surface3:  'oklch(0.910 0.008 90)',   // --surface-3: dust, recessed panels
  ink:       'oklch(0.235 0.010 110)',  // --ink
  ink2:      'oklch(0.38 0.010 110)',   // --ink-2
  ink3:      'oklch(0.46 0.010 108)',   // --ink-3: the .step-art currentColor — main stroke
  line:      'oklch(0.900 0.008 95)',   // --line
  line2:     'oklch(0.840 0.010 95)',   // --line-2
  primary:   'oklch(0.555 0.145 55)',   // terracotta accent
  primaryBg: 'oklch(0.960 0.020 60)',
  honey:     'oklch(0.885 0.078 90)',
  honey2:    'oklch(0.72 0.105 82)',
  sage:      'oklch(0.55 0.065 145)',
  sageBg:    'oklch(0.948 0.024 148)',
} as const;

/* One loop length per action, matching the CSS animation durations of the
   inline STEP_ART scenes (css/components.css) so the produced clip keeps the
   same cadence the design settled on. */
export const FPS = 30;
export const LOOP_SECONDS: Record<string, number> = {
  purge: 3.58, unload: 3.58, wipe: 3.07, label: 3.33, hang: 3.58,
  fold: 3.58, photo: 3.07, contain: 3.33, group: 3.0,
  moveUp: 3.58, moveDown: 3.58, zones: 3.84, done: 3.33,
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

import React from 'react';
import { STAGE_MARGIN, VIEW_H } from './tokens';

/* The item being moved in a scene — the {glyph} part of the media key.
   Each glyph is drawn in local coordinates with its bottom-center at the
   origin (feet at y=0, extending upward into negative y), so a scene places
   one with translate(x, surfaceY) and it stands on the surface. The one
   exception is `hanger`, whose hook tip is at the origin so it hangs from a
   rail with translate(x, railY).

   Max extent: ~16 wide × ~15 tall — sized to fit between shelf planes.
   Strokes are slightly lighter than furniture (2 vs 2.5) so items read as
   contents rather than structure, matching how js/icons.js weights details. */

const G: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <g strokeWidth={2}>{children}</g>
);

const BODIES: Record<string, React.ReactNode> = {
  can: (
    <G>
      <rect x={-5} y={-13} width={10} height={13} rx={1.5} />
      <path d="M-5 -10 h10" />
    </G>
  ),
  jar: (
    <G>
      <rect x={-5.5} y={-10} width={11} height={10} rx={2} />
      <rect x={-4} y={-13.5} width={8} height={3.5} rx={1} />
    </G>
  ),
  bottle: (
    <G>
      <path d="M-2 -14.5 h4 v4.5 q4 1.5 4 5 v3 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 v-3 q0 -3.5 4 -5 z" />
    </G>
  ),
  towel: (
    <G>
      <rect x={-7.5} y={-9} width={15} height={9} rx={1.5} />
      <path d="M-7.5 -4.5 h15" />
    </G>
  ),
  foldedclothes: (
    <G>
      <rect x={-7.5} y={-5} width={15} height={5} rx={1} />
      <rect x={-6.5} y={-10} width={13} height={5} rx={1} />
    </G>
  ),
  plate: (
    <G>
      <circle cx={0} cy={-7} r={7} />
      <circle cx={0} cy={-7} r={3.2} />
    </G>
  ),
  utensil: (
    <G>
      <path d="M0 0 V-8" />
      <ellipse cx={0} cy={-11} rx={2.6} ry={3.4} />
    </G>
  ),
  tool: (
    <G>
      <path d="M0 0 V-11" />
      <rect x={-5.5} y={-15} width={11} height={4} rx={1} />
    </G>
  ),
  tote: (
    <G>
      <rect x={-8} y={-11.5} width={16} height={11.5} rx={1.5} />
      <path d="M-8 -7.5 h16" />
      <path d="M-2.5 -3.5 h5" />
    </G>
  ),
  bag: (
    <G>
      <path d="M-6 0 h12 v-9.5 l-2 -2 l-2 2 l-2 -2 l-2 2 l-2 -2 l-2 2 z" />
    </G>
  ),
  shoe: (
    <G>
      <path d="M-8 0 h16 c0 -2.8 -2.2 -4.2 -4.8 -4.9 l-3.4 -0.9 c-1.2 -1.8 -3.2 -2.7 -5.3 -2.4 l-2.5 0.4 z" />
      <path d="M-8 -2.5 h4" />
    </G>
  ),
  /* Fridge food. A carton stands for dairy and juice, the lidded box for
     leftovers and meals, the apple for produce, the drumstick for meat. */
  carton: (
    <G>
      <path d="M-5 0 V-9.5 L-2.5 -12.5 H2.5 L5 -9.5 V0 Z" />
      <path d="M-5 -9.5 H5 M-1.8 -12.5 v-2 h3.6 v2" />
    </G>
  ),
  produce: (
    <G>
      <path d="M0 -9.5 c-2 -1.6 -6.5 -1.6 -6.5 3.2 c0 3.6 2.6 6.3 4.6 6.3 c0.8 0 1.3 -0.4 1.9 -0.4 s1.1 0.4 1.9 0.4 c2 0 4.6 -2.7 4.6 -6.3 c0 -4.8 -4.5 -4.8 -6.5 -3.2 z" />
      <path d="M0 -9.5 V-12.5 M0.6 -11.6 c1.4 -2 3.4 -2.2 4.6 -1.6 c-1 1.8 -3 2.2 -4.6 1.6 z" />
    </G>
  ),
  leftovers: (
    <G>
      <path d="M-7 -6 L-6.2 -1.4 a1.6 1.6 0 0 0 1.6 1.4 H4.6 a1.6 1.6 0 0 0 1.6 -1.4 L7 -6" />
      <rect x={-8} y={-9} width={16} height={3} rx={1.2} />
      <path d="M-3 -11 h6" />
    </G>
  ),
  meat: (
    <G>
      <path d="M-1.5 -2.5 c-3 1.6 -7 0.4 -7.2 -3 c-0.2 -3.6 3.4 -6 6.6 -4.6 c2.2 1 3 3 2.6 4.8 z" />
      <path d="M0.5 -5.3 L4.6 -1.6" />
      <circle cx={5.8} cy={-2.6} r={1.5} />
      <circle cx={4.4} cy={-0.4} r={1.5} />
    </G>
  ),
  hanger: (
    <G>
      <path d="M0 0.5 c0 -2.6 2.8 -2.8 2.8 -0.8" />
      <path d="M-9.5 10 L0 3.5 L9.5 10 Z" />
    </G>
  ),
};

export const GLYPH_KINDS = Object.keys(BODIES);

/* How far a glyph reaches above and below its origin, stroke included. Every
   standing glyph is at most 15.5 tall; the hanger hangs from its hook. */
const REACH: Record<string, [up: number, down: number]> = { hanger: [3.5, 11] };
const reach = (kind: string): [number, number] => REACH[kind] ?? [16.5, 1];

/* A glyph never leaves the frame. Scenes move items by fixed distances (rise
   16, lift 10) from surfaces at different heights on different furniture, and
   a rise that suits a shelf at y=46 carried an item off the top of the band
   from a counter at y=18. The clamp keeps every item whole; check-edges.mjs
   still measures the furniture and the accents, which this cannot reach. */
const fitY = (kind: string, y: number, scale: number) => {
  const [up, down] = reach(kind);
  return Math.min(Math.max(y, STAGE_MARGIN + up * scale), VIEW_H - STAGE_MARGIN - down * scale);
};

export const Glyph: React.FC<{
  kind: string;
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
}> = ({ kind, x = 0, y = 0, opacity = 1, scale = 1 }) => (
  <g transform={`translate(${x} ${fitY(kind, y, scale)}) scale(${scale})`} opacity={opacity}>
    {BODIES[kind] ?? BODIES.tote}
  </g>
);

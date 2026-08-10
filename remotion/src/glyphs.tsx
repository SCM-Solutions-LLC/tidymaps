import React from 'react';

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
  hanger: (
    <G>
      <path d="M0 0.5 c0 -2.6 2.8 -2.8 2.8 -0.8" />
      <path d="M-9.5 10 L0 3.5 L9.5 10 Z" />
    </G>
  ),
};

export const GLYPH_KINDS = Object.keys(BODIES);

export const Glyph: React.FC<{
  kind: string;
  x?: number;
  y?: number;
  opacity?: number;
  scale?: number;
}> = ({ kind, x = 0, y = 0, opacity = 1, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    {BODIES[kind] ?? BODIES.tote}
  </g>
);

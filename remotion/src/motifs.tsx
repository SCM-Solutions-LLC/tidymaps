import React from 'react';
import { color, FLOOR_Y } from './tokens';

/* The furniture each scene is staged on — the {motif} part of the media key.
   Same line language as the wizard's art(): ink-3 strokes, light line-2
   floor, no fills. Every motif publishes its working geometry so a scene can
   place glyphs without knowing which furniture it landed on:

   - surfaces: horizontal planes items can sit on, top→bottom, each with its
     y and usable x range. surfaces[work] is the main working plane.
   - anchorXs: three comfortable item positions on the working plane.
   - levels: a high and a low spot, for the moveUp/moveDown stories.
   - railY/railX: present when the motif has something to hang from (the
     closet rod, the bench's pegboard row). Scenes that must hang on a
     motif with no rail (hang-shelves-*) draw their own short rod at railY.
   - boxSpot: a clear patch of floor beside the furniture for crates and bins.
*/
export type Surface = { y: number; x1: number; x2: number };
export type MotifGeo = {
  surfaces: Surface[];
  work: number;
  anchorXs: [number, number, number];
  levels: { high: { x: number; y: number }; low: { x: number; y: number } };
  railY: number;
  railX: [number, number];
  hasRail: boolean;
  boxSpot: { x: number; y: number };
};

export const MOTIF_GEO: Record<string, MotifGeo> = {
  shelves: {
    surfaces: [
      { y: 26, x1: 96, x2: 224 },
      { y: 46, x1: 96, x2: 224 },
      { y: 66, x1: 96, x2: 224 },
    ],
    work: 1,
    anchorXs: [122, 160, 198],
    levels: { high: { x: 160, y: 26 }, low: { x: 160, y: 66 } },
    railY: 14, railX: [110, 210], hasRail: false,
    boxSpot: { x: 268, y: FLOOR_Y },
  },
  drawers: {
    surfaces: [{ y: 18, x1: 106, x2: 214 }],
    work: 0,
    anchorXs: [132, 160, 188],
    levels: { high: { x: 160, y: 30.5 }, low: { x: 160, y: 63 } },
    railY: 8, railX: [116, 204], hasRail: false,
    boxSpot: { x: 262, y: FLOOR_Y },
  },
  rail: {
    surfaces: [{ y: 10, x1: 76, x2: 244 }],
    work: 0,
    anchorXs: [118, 160, 202],
    levels: { high: { x: 160, y: 10 }, low: { x: 160, y: FLOOR_Y } },
    railY: 17, railX: [70, 250], hasRail: true,
    boxSpot: { x: 282, y: FLOOR_Y },
  },
  bench: {
    surfaces: [{ y: 50, x1: 92, x2: 228 }],
    work: 0,
    anchorXs: [124, 160, 196],
    levels: { high: { x: 160, y: 26 }, low: { x: 160, y: FLOOR_Y } },
    railY: 20, railX: [116, 204], hasRail: true,
    boxSpot: { x: 268, y: FLOOR_Y },
  },
};

const Floor: React.FC = () => (
  <line x1={24} y1={FLOOR_Y} x2={296} y2={FLOOR_Y} stroke={color.line2} />
);

/* An open shelf unit: two uprights, three shelves. */
const Shelves: React.FC = () => (
  <g>
    <Floor />
    <path d="M88 10 V72 M232 10 V72 M88 10 H232" />
    <path d="M88 26 H232 M88 46 H232 M88 66 H232" />
  </g>
);

/* A three-drawer bank under a counter lip. */
const Drawers: React.FC = () => (
  <g>
    <Floor />
    <rect x={110} y={18} width={100} height={54} rx={3} />
    <path d="M100 18 H220" />
    <rect x={116} y={24} width={88} height={13} rx={2} />
    <rect x={116} y={41} width={88} height={13} rx={2} />
    <rect x={116} y={58} width={88} height={11} rx={2} />
    <path d="M152 30.5 h16 M152 47.5 h16 M152 63.5 h16" />
  </g>
);

/* A closet rod hanging under its shelf. */
const Rail: React.FC = () => (
  <g>
    <Floor />
    <path d="M60 10 H260" />
    <path d="M70 17 H250" />
    <path d="M80 10 V17 M240 10 V17" />
  </g>
);

/* A workbench with a pegboard above it. */
const Bench: React.FC = () => (
  <g>
    <Floor />
    <rect x={110} y={10} width={100} height={24} rx={2} />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3, 4, 5].map((c) => (
        <circle
          key={`${r}-${c}`}
          cx={122 + c * 15.2}
          cy={16.5 + r * 8}
          r={0.9}
          fill={color.line2}
          stroke="none"
        />
      )),
    )}
    <path d="M84 50 H236" />
    <path d="M84 54 H236" />
    <path d="M92 54 V72 M228 54 V72" />
  </g>
);

export const Motif: React.FC<{ kind: string }> = ({ kind }) => {
  switch (kind) {
    case 'drawers': return <Drawers />;
    case 'rail': return <Rail />;
    case 'bench': return <Bench />;
    default: return <Shelves />;
  }
};

export const geoFor = (kind: string): MotifGeo => MOTIF_GEO[kind] ?? MOTIF_GEO.shelves;

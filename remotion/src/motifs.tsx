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
   - bins: where the purge story's three bins stand, on the floor clear of the
     furniture, bins[i] taking the item at anchorXs[i]. They used to stand in
     front of the bottom shelf, so items fell through the furniture into them
     and their bases sat on the frame's bottom edge.

   Everything stays 3 units inside the 320x80 frame (STAGE_MARGIN) at every
   frame of every scene; check-edges.mjs measures the rendered clips. A shelf
   at y=10 put items standing on it at y=-5, cut off at the top of the band. */
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
  bins: [number, number, number];
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
    bins: [56, 258, 284],
  },
  /* The top drawer pulled open, items standing in it; one closed drawer
     below. Items used to stand on the counter above a closed bank, which put
     a utensil's tip at the top edge of the frame and nothing in a drawer. */
  drawers: {
    surfaces: [{ y: 36, x1: 106, x2: 214 }],
    work: 0,
    anchorXs: [134, 160, 186],
    levels: { high: { x: 160, y: 36 }, low: { x: 160, y: 65 } },
    railY: 8, railX: [116, 204], hasRail: false,
    boxSpot: { x: 262, y: FLOOR_Y },
    bins: [56, 256, 282],
  },
  rail: {
    surfaces: [{ y: 20, x1: 76, x2: 244 }],
    work: 0,
    anchorXs: [118, 160, 202],
    levels: { high: { x: 160, y: 20 }, low: { x: 160, y: FLOOR_Y } },
    railY: 27, railX: [70, 250], hasRail: true,
    boxSpot: { x: 282, y: FLOOR_Y },
    bins: [40, 272, 296],
  },
  bench: {
    surfaces: [{ y: 50, x1: 92, x2: 228 }],
    work: 0,
    anchorXs: [124, 160, 196],
    levels: { high: { x: 160, y: 31 }, low: { x: 160, y: FLOOR_Y } },
    railY: 20, railX: [116, 204], hasRail: true,
    boxSpot: { x: 268, y: FLOOR_Y },
    bins: [52, 262, 288],
  },
  /* An open fridge: two glass shelves, two crisper drawers, and the door
     swung open on the right with its bins. */
  fridge: {
    surfaces: [
      { y: 27, x1: 108, x2: 212 },
      { y: 47, x1: 108, x2: 212 },
    ],
    work: 1,
    anchorXs: [132, 160, 188],
    levels: { high: { x: 160, y: 27 }, low: { x: 134, y: 64 } },
    railY: 14, railX: [116, 204], hasRail: false,
    boxSpot: { x: 278, y: FLOOR_Y },
    bins: [62, 264, 290],
  },
  /* A kitchen wall cabinet with both doors open and one shelf. */
  cabinet: {
    surfaces: [
      { y: 38, x1: 108, x2: 212 },
      { y: 68, x1: 108, x2: 212 },
    ],
    work: 0,
    anchorXs: [136, 160, 184],
    levels: { high: { x: 160, y: 38 }, low: { x: 160, y: 68 } },
    railY: 16, railX: [116, 204], hasRail: false,
    boxSpot: { x: 268, y: FLOOR_Y },
    bins: [54, 256, 282],
  },
  /* A vanity with its doors open: the basin's drain and trap down the middle,
     a half shelf beside it, the cabinet floor where the things live. */
  undersink: {
    surfaces: [
      { y: 44, x1: 110, x2: 146 },
      { y: 64, x1: 110, x2: 210 },
    ],
    work: 1,
    anchorXs: [136, 160, 184],
    levels: { high: { x: 128, y: 44 }, low: { x: 128, y: 64 } },
    railY: 20, railX: [112, 208], hasRail: false,
    boxSpot: { x: 270, y: FLOOR_Y },
    bins: [52, 256, 282],
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

/* A drawer bank under a counter lip, its top drawer pulled toward you: the
   drawer's back edge and sides show above its front, so whatever stands on
   that front reads as standing in the drawer. */
const Drawers: React.FC = () => (
  <g>
    <Floor />
    <path d="M100 14 H220" />
    <path d="M110 14 V26 M210 14 V26 M110 49 V70 M210 49 V70 M110 70 H210" />
    <path d="M114 26 H206 M114 26 L106 36 M206 26 L214 36" />
    <rect x={104} y={36} width={112} height={11} rx={2.5} />
    <path d="M150 41.5 h20" />
    <rect x={116} y={52} width={88} height={14} rx={2} />
    <path d="M152 59 h16" />
  </g>
);

/* A closet rod hanging under its shelf. */
const Rail: React.FC = () => (
  <g>
    <Floor />
    <path d="M60 20 H260" />
    <path d="M70 27 H250" />
    <path d="M80 20 V27 M240 20 V27" />
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

/* An open fridge: rounded body, two shelves, two crisper drawers, and the
   door swung open beside it with two door bins. */
const Fridge: React.FC = () => (
  <g>
    <Floor />
    <rect x={104} y={6} width={112} height={64} rx={6} />
    <path d="M108 27 H212 M108 47 H212" />
    <rect x={110} y={52} width={48} height={15} rx={2} />
    <rect x={162} y={52} width={48} height={15} rx={2} />
    <path d="M126 56 h16 M178 56 h16" />
    <rect x={222} y={6} width={18} height={64} rx={4} />
    <path d="M225 24 v7 h12 v-7 M225 46 v7 h12 v-7" />
  </g>
);

/* A kitchen wall cabinet, both doors swung open, one shelf. */
const Cabinet: React.FC = () => (
  <g>
    <Floor />
    <rect x={108} y={8} width={104} height={60} rx={3} />
    <path d="M108 38 H212" />
    <rect x={92} y={8} width={12} height={60} rx={2} />
    <rect x={216} y={8} width={12} height={60} rx={2} />
    <path d="M100 36 v6 M220 36 v6" />
  </g>
);

/* A vanity under its basin, doors open: the drain drops from the bowl into a
   trap and runs to the back wall, a half shelf stands left of it, and the
   cabinet floor sits above the toe kick. */
const Undersink: React.FC = () => (
  <g>
    <Floor />
    <path d="M98 14 H222" />
    <path d="M142 14 v3 a7 7 0 0 0 7 7 h22 a7 7 0 0 0 7 -7 v-3" />
    <rect x={106} y={14} width={108} height={56} rx={3} />
    <path d="M106 64 H214" />
    <path d="M110 44 H146" />
    <path d="M160 24 V35 a6 6 0 0 0 12 0 V31 H210" />
    <rect x={90} y={16} width={12} height={52} rx={2} />
    <rect x={218} y={16} width={12} height={52} rx={2} />
    <path d="M98 38 v6 M222 38 v6" />
  </g>
);

export const Motif: React.FC<{ kind: string }> = ({ kind }) => {
  switch (kind) {
    case 'drawers': return <Drawers />;
    case 'rail': return <Rail />;
    case 'bench': return <Bench />;
    case 'fridge': return <Fridge />;
    case 'cabinet': return <Cabinet />;
    case 'undersink': return <Undersink />;
    default: return <Shelves />;
  }
};

export const geoFor = (kind: string): MotifGeo => MOTIF_GEO[kind] ?? MOTIF_GEO.shelves;

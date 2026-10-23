import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kfLinear } from '../anim';
import { color } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* zones — "give every category its own zone". Port of the sa-zones scene:
   three pale zone bands (honey / primary-bg / sage-bg) breathe in sequence
   (sa-fade with 0.35s steps). The bands sit where the motif's real zones
   are — shelf gaps, drawer faces, rod sections, bench regions — with a few
   items in place so the zones are zoning something. */
type Band = { x: number; y: number; w: number; h: number };
const BANDS: Record<string, Band[]> = {
  shelves: [
    { x: 96, y: 12, w: 128, h: 12 },
    { x: 96, y: 28, w: 128, h: 16 },
    { x: 96, y: 48, w: 128, h: 16 },
  ],
  // the open drawer's three organizer compartments
  drawers: [
    { x: 114, y: 27, w: 32, h: 8 },
    { x: 148, y: 27, w: 24, h: 8 },
    { x: 174, y: 27, w: 32, h: 8 },
  ],
  rail: [
    { x: 76, y: 30, w: 54, h: 38 },
    { x: 134, y: 30, w: 54, h: 38 },
    { x: 192, y: 30, w: 52, h: 38 },
  ],
  bench: [
    { x: 112, y: 12, w: 96, h: 20 },
    { x: 92, y: 42, w: 136, h: 6 },
    { x: 100, y: 58, w: 120, h: 12 },
  ],
  // a shelf, the crispers, the door bins: the zones a fridge plan names
  fridge: [
    { x: 110, y: 30, w: 100, h: 15 },
    { x: 112, y: 54, w: 96, h: 11 },
    { x: 224, y: 9, w: 14, h: 58 },
  ],
  cabinet: [
    { x: 111, y: 11, w: 47, h: 25 },
    { x: 162, y: 11, w: 47, h: 25 },
    { x: 111, y: 41, w: 98, h: 25 },
  ],
  // the half shelf, then the floor either side of the trap
  undersink: [
    { x: 110, y: 28, w: 36, h: 14 },
    { x: 110, y: 47, w: 44, h: 15 },
    { x: 166, y: 47, w: 44, h: 15 },
  ],
};
/* Where the zoned items stand, one per band, on furniture whose zones are not
   simply its shelves or its rod. */
const ZONE_ITEMS: Record<string, Array<{ x: number; y: number; s?: number }>> = {
  drawers: [{ x: 130, y: 36 }, { x: 160, y: 36 }, { x: 190, y: 36 }],
  fridge: [{ x: 160, y: 47 }, { x: 186, y: 64 }, { x: 231, y: 31, s: 0.62 }],
  cabinet: [{ x: 134, y: 38 }, { x: 186, y: 38 }, { x: 160, y: 68 }],
  undersink: [{ x: 128, y: 44 }, { x: 132, y: 64 }, { x: 188, y: 64 }],
};
const FILLS = [color.honey, color.primaryBg, color.sageBg];

export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y, geo } = itemSpots(motif, glyph);
  const bands = BANDS[motif] ?? BANDS.shelves;

  return (
    <g>
      {bands.map((b, i) => {
        const f = (frame - i * 0.35 * fps + dur) % dur;
        // sa-fade: dark until 25%, lit 50–90%, out by 100%
        const o = kfLinear(f, dur, [[0, 0], [25, 0], [50, 1], [90, 1], [100, 0]]);
        return (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2}
            fill={FILLS[i]} stroke="none" opacity={o} />
        );
      })}
      {ZONE_ITEMS[motif]
        ? ZONE_ITEMS[motif].map((p, i) => <Glyph key={i} kind={glyph} x={p.x} y={p.y} scale={p.s ?? 1} />)
        : motif === 'shelves'
        ? geo.surfaces.map((s, i) => <Glyph key={i} kind={glyph} x={xs[i]} y={s.y} />)
        : motif === 'rail'
          ? bands.map((b, i) => <Glyph key={i} kind={glyph} x={b.x + b.w / 2} y={y} />)
          : xs.map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}
    </g>
  );
};

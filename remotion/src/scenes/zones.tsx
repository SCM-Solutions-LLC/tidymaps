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
  drawers: [
    { x: 118, y: 26, w: 84, h: 9 },
    { x: 118, y: 43, w: 84, h: 9 },
    { x: 118, y: 60, w: 84, h: 7 },
  ],
  rail: [
    { x: 76, y: 22, w: 54, h: 42 },
    { x: 134, y: 22, w: 54, h: 42 },
    { x: 192, y: 22, w: 52, h: 42 },
  ],
  bench: [
    { x: 112, y: 12, w: 96, h: 20 },
    { x: 92, y: 42, w: 136, h: 6 },
    { x: 100, y: 58, w: 120, h: 12 },
  ],
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
      {motif === 'shelves'
        ? geo.surfaces.map((s, i) => <Glyph key={i} kind={glyph} x={xs[i]} y={s.y} />)
        : motif === 'rail'
          ? bands.map((b, i) => <Glyph key={i} kind={glyph} x={b.x + b.w / 2} y={y} />)
          : xs.map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}
    </g>
  );
};

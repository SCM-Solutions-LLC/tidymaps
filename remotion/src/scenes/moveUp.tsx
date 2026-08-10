import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { color, EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* moveUp — "move it up high". Port of the sa-up scene: the box glides from
   its shelf to the one above and settles, with a primary arrow calling the
   direction (sa-move-up: rest to 18%, arrived by 55%, hold to 85%, return —
   the return is the spec's loop). Here the glyph travels between the
   motif's low and high levels. */
const ARROW_X: Record<string, number> = { shelves: 252, drawers: 240, rail: 272, bench: 256 };

export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { geo } = itemSpots(motif, glyph);
  const { high, low } = geo.levels;
  const ax = ARROW_X[motif] ?? 252;

  const t = kf(frame, dur, [[0, 0], [18, 0], [55, 1], [85, 1], [100, 0]], EASE);
  return (
    <g>
      <Glyph kind={glyph} x={low.x + (high.x - low.x) * t} y={low.y + (high.y - low.y) * t} />
      <g stroke={color.primary}>
        <path d={`M${ax} 52 V28`} />
        <path d={`M${ax - 6} 34 L${ax} 28 L${ax + 6} 34`} />
      </g>
    </g>
  );
};

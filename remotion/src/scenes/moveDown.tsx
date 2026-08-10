import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { color, EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* moveDown — "heavy things live low". Exact mirror of moveUp, per the
   sa-down spec: the glyph glides from the high level to the low one and the
   arrow points the way down. */
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
      <Glyph kind={glyph} x={high.x + (low.x - high.x) * t} y={high.y + (low.y - high.y) * t} />
      <g stroke={color.primary}>
        <path d={`M${ax} 28 V52`} />
        <path d={`M${ax - 6} 46 L${ax} 52 L${ax + 6} 46`} />
      </g>
    </g>
  );
};

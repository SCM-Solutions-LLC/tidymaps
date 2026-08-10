import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { color, EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* done — "finished, enjoy it". Port of the sa-done scene: a circled check
   drawing itself in primary (sa-draw: dashoffset 30 → 0 between 15% and
   50%, held to 85%, reset at the loop point — the reset is the spec). The
   badge gets a bg fill so the check reads over the furniture, and the tidy
   items stay visible around it. */
const CHECK_LEN = 26; // measured length of the check path below

export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);

  const off = kf(frame, dur, [[0, CHECK_LEN], [15, CHECK_LEN], [50, 0], [85, 0], [100, CHECK_LEN]], EASE);
  return (
    <g>
      {xs.map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}
      <g transform="translate(160 42)">
        <circle r={15} fill={color.bg} />
        <path d="M-8 1 l5.5 5.5 L9 -5" stroke={color.primary} strokeWidth={3}
          strokeDasharray={CHECK_LEN} strokeDashoffset={off} />
      </g>
    </g>
  );
};

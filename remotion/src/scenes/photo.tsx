import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { color } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* photo — "take a photo of the finished space". Port of the sa-photo scene:
   the camera sits in the foreground (bg-filled so the furniture doesn't
   clutter it) and its flash pulses from the lens — scale 1 → 2.6 with a
   0 → 0.9 → 0 opacity spike between 42% and 62% (sa-flash). The tidy items
   stay in place behind it. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);
  const cx = 160, cy = 44;

  const fs = kf(frame, dur, [[0, 1], [42, 1], [50, 2.6], [62, 1], [100, 1]], [0, 0, 0.58, 1]);
  const fo = kfLinear(frame, dur, [[0, 0], [42, 0], [50, 0.9], [62, 0], [100, 0]]);

  return (
    <g>
      {xs.map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}
      <g transform={`translate(${cx} ${cy})`}>
        <rect x={-15} y={-9} width={30} height={22} rx={4} fill={color.bg} />
        <path d="M-6 -9 l2.5 -4 h7 L6 -9" fill={color.bg} />
        <circle cx={0} cy={2} r={6.5} />
        <circle cx={0} cy={2} r={3 * fs} fill={color.honey} stroke="none" opacity={fo} />
      </g>
    </g>
  );
};

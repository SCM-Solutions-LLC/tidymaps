import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { color } from '../tokens';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* wipe — "cloth along the surface". Port of the sa-wipe scene: a round pad
   (primary tones) sweeps along the working surface while the dust strip
   (surface-3) collapses ahead of it, then the pad returns for the next pass
   (sa-sweep / sa-fade-dust, 3.07s). The dust popping back at the loop point
   is in the spec — it reads as a fresh pass. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { geo } = itemSpots(motif, glyph);
  const s = geo.surfaces[geo.work];

  const padR = 8;
  const startX = s.x1 + padR + 2;
  const endX = s.x2 - padR - 2;
  // sa-sweep: 0–10% at rest, arrives 55–65%, home again by 100%
  const padX = kf(frame, dur, [[0, startX], [10, startX], [55, endX], [65, endX], [100, startX]], [0.2, 0.7, 0.3, 1]);
  // sa-fade-dust: collapses toward the far end and fades by 55%
  const dustT = kf(frame, dur, [[0, 1], [10, 1], [55, 0], [100, 0]], [0.2, 0.7, 0.3, 1]);
  const dustO = kfLinear(frame, dur, [[0, 0.9], [10, 0.9], [55, 0], [100, 0]]);

  const dustX1 = s.x1 + 6;
  const dustX2 = s.x2 - 6;
  const dustW = (dustX2 - dustX1) * dustT;

  return (
    <g>
      <rect
        x={dustX2 - dustW}
        y={s.y - 6}
        width={dustW}
        height={5}
        rx={2.5}
        fill={color.surface3}
        stroke="none"
        opacity={dustO}
      />
      <circle cx={padX} cy={s.y - padR + 1} r={padR} fill={color.primaryBg} stroke={color.primary} />
    </g>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* contain — "corral loose items into a basket". Port of the sa-contain
   scene: two loose items slide down into the basket and fade once they're
   in (sa-slide-in, 3.33s, staggered 0.5s as a phase shift). The basket is
   furniture-scale plain ink, standing on the working surface — or on the
   floor under the rod when the story hangs from a rail. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y, hung } = itemSpots(motif, glyph);

  // the basket: an open trapezoid with one weave line
  const bx = xs[1];
  const by = hung ? 72 : y; // hung stories drop into a basket on the floor
  const mouthY = by - 14;

  const stagger = 0.5 * fps;
  const startY = hung ? y : mouthY - 18; // hangers leave the rod itself
  // items settle with their feet near the basket floor, occluded by its front;
  // hangers (top-anchored, 0.75-scaled) land hanging just inside the mouth
  const endY = hung ? mouthY + 2 : by - 3;
  return (
    <g>
      {[bx - 11, bx + 11].map((x, i) => {
        const f = (frame - i * stagger + dur) % dur;
        // sa-slide-in: rest until 15%, inside by 55%, fade 70–85%
        const gy = kf(f, dur, [[0, startY], [15, startY], [55, endY], [100, endY]], EASE);
        const o = kfLinear(f, dur, [[0, 1], [70, 1], [85, 0], [100, 0]]);
        return <Glyph key={i} kind={glyph} x={x} y={gy} opacity={o} scale={0.75} />;
      })}
      <g strokeWidth={2}>
        <path d={`M${bx - 17} ${mouthY} L${bx - 13.5} ${by} H${bx + 13.5} L${bx + 17} ${mouthY} Z`} />
        <path d={`M${bx - 15} ${by - 7} H${bx + 15}`} />
      </g>
    </g>
  );
};

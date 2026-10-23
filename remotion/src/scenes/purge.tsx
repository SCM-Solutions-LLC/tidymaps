import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { Bin, EASE_IN, itemSpots } from './helpers';

/* purge — "sort into keep, donate, toss". Three tri-tone bins stand on the
   floor beside the furniture; each item lifts off its surface, is carried
   out to its bin and dropped in, then fades (3.58s, staggered 0.45s, the
   stagger a modular phase shift so the loop stays seamless). Items render
   behind the bins, so they read as landing inside.

   The bins used to stand in front of the bottom shelf with their bases on
   the frame's bottom edge, and the items fell straight down through every
   shelf or drawer between them: a can passing through the bottom shelf, a
   spoon through two drawer fronts. Now nothing passes through furniture
   except on the way out of it, which is what taking something out looks
   like from the front.

   Items carried to the right leave rightmost first, and to the left leftmost
   first, so one never passes over another still waiting on the shelf. */
const BIN_W = 22;
const BIN_H = 13;
const LIFT = 10;

export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y, hung, geo } = itemSpots(motif, glyph);

  const floor = geo.boxSpot.y;
  const mouth = floor - BIN_H;
  // a hanger is drawn down from its hook; it lands with its bar in the bin
  const landY = hung ? mouth - 4 : floor - 3;
  const carryY = y - LIFT;
  const stagger = 0.45 * fps;

  const order = xs
    .map((x, i) => ({ i, key: geo.bins[i] > x ? -x : x + 1000 }))
    .sort((a, b) => a.key - b.key)
    .map((o) => o.i);

  return (
    <g>
      {xs.map((x, i) => {
        const f = (frame - order.indexOf(i) * stagger + dur) % dur;
        const bx = geo.bins[i];
        // back on the shelf by 10%, lifted by 22%, over its bin by 42%,
        // in it by 55%, gone by 70%
        const gx = kf(f, dur, [[0, x], [22, x], [42, bx], [100, bx]], EASE);
        const gy = f < (42 / 100) * dur
          ? kf(f, dur, [[0, y], [12, y], [22, carryY], [42, carryY]], EASE)
          : kf(f, dur, [[42, carryY], [55, landY], [100, landY]], EASE_IN);
        const o = kfLinear(f, dur, [[0, 0], [10, 1], [55, 1], [70, 0], [100, 0]]);
        return <Glyph key={i} kind={glyph} x={gx} y={gy} opacity={o} />;
      })}
      {geo.bins.map((bx, i) => <Bin key={i} cx={bx} y={floor} w={BIN_W} h={BIN_H} tone={i} />)}
    </g>
  );
};

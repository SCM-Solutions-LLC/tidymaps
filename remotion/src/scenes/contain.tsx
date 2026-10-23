import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { color, EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* contain — "corral loose items into a basket". Two loose items standing
   either side of the basket hop over its rim and settle inside, then fade
   (3.33s, staggered 0.5s as a phase shift). The basket is furniture-scale
   plain ink on the working surface, or on the floor under the rod when the
   story hangs from a rail.

   The items used to fall in from 18 units above the basket's mouth, which on
   any furniture with a shelf overhead meant falling through that shelf, and
   on a fridge started them outside its top. A compartment is 20 units tall,
   too short to lift an item clear over a rim, so the basket's front is
   opaque and the items slide in behind it with their tops showing. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y, hung } = itemSpots(motif, glyph);

  // the basket: an open trapezoid with one weave line
  const bx = xs[1];
  const by = hung ? 72 : y; // hung stories drop into a basket on the floor
  const mouthY = by - 12;

  const stagger = 0.5 * fps;
  // standing items wait beside the basket and hop over its rim; hangers
  // (top-anchored, 0.75-scaled) leave the rod and land just inside the mouth
  const restY = hung ? y : by;
  const hopY = hung ? y : by - 6;
  const endY = hung ? mouthY + 2 : by - 2;
  return (
    <g>
      {[-1, 1].map((side, i) => {
        const f = (frame - i * stagger + dur) % dur;
        const fromX = hung ? bx + side * 11 : bx + side * 27;
        const toX = bx + side * 7;
        // rest until 15%, over the rim by 38%, inside by 55%, fade 70–85%
        const gx = kf(f, dur, [[0, fromX], [15, fromX], [38, toX], [100, toX]], EASE);
        const gy = kf(f, dur, [[0, restY], [15, restY], [38, hopY], [55, endY], [100, endY]], EASE);
        const o = kfLinear(f, dur, [[0, 0], [8, 1], [70, 1], [85, 0], [100, 0]]);
        return <Glyph key={i} kind={glyph} x={gx} y={gy} opacity={o} scale={0.75} />;
      })}
      <g strokeWidth={2}>
        <path d={`M${bx - 17} ${mouthY} L${bx - 13.5} ${by} H${bx + 13.5} L${bx + 17} ${mouthY} Z`} fill={color.bg} />
        <path d={`M${bx - 15.5} ${by - 6} H${bx + 15.5}`} />
      </g>
    </g>
  );
};

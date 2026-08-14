import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { EASE_PHYSICAL } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* stock — "load the shelves". Port of the sa-stock scene: items arriving on
   the surface and STAYING there (sa-land, 3.58s, staggered 0.55s), which is
   the deliberate inverse of `unload` lifting them off it. Those two are the
   bookends of a plan and a reader should be able to tell them apart at a
   glance.

   This was the gap in the produced set. `stock` is the commonest instruction
   a real plan gives — load the back wall first, stock the canned goods, put
   the spices on the turntable — and it was the one action in the vocabulary
   with no composition, so every one of those steps fell back to the inline
   SVG while the steps around it played video.

   Three items, not two: a shelf that ends the loop full is the whole point,
   and the landing carries a physical overshoot (EASE_PHYSICAL) so each one
   settles rather than snapping to a stop. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);

  const stagger = 0.55 * fps;
  return (
    <g>
      {xs.map((x, i) => {
        const f = (frame - i * stagger + dur) % dur;
        // sa-land: waiting above and invisible until 15%, visible by 35%,
        // down and settled by 55%, held to the end of the loop
        const gy = kf(f, dur, [[0, y - 16], [15, y - 16], [55, y], [100, y]], EASE_PHYSICAL);
        const o = kfLinear(f, dur, [[0, 0], [15, 0], [35, 1], [100, 1]]);
        return <Glyph key={i} kind={glyph} x={x} y={gy} opacity={o} />;
      })}
    </g>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { Crate, EASE_OUT_CSS, itemSpots } from './helpers';

/* unload — "empty everything out first". Port of the sa-unload scene: an
   open crate, items rising out and fading away (sa-rise, 3.58s, staggered
   0.5s). Here the items lift off the furniture itself — start sunken and
   invisible, surface by 35%, float 16 units up by 60%, fade 90–100% — with
   the crate at the furniture's side as the destination cue. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y: spotY, geo } = itemSpots(motif, glyph);
  // On the drawer bank items emerge from the top drawer, not the counter —
  // rising 16 from the countertop would carry them clean off the stage.
  const y = motif === 'drawers' ? geo.levels.high.y : spotY;

  const stagger = 0.5 * fps;
  return (
    <g>
      <Crate cx={geo.boxSpot.x} y={geo.boxSpot.y} />
      {[xs[0], xs[2]].map((x, i) => {
        const f = (frame - i * stagger + dur) % dur;
        // sa-rise: sunken +8 and hidden until 20%, up to −16 by 60%, gone by 100%
        const gy = kf(f, dur, [[0, y + 8], [20, y + 8], [60, y - 16], [75, y - 16], [100, y - 16]], EASE_OUT_CSS);
        const o = kfLinear(f, dur, [[0, 0], [20, 0], [35, 1], [75, 1], [90, 0], [100, 0]]);
        return <Glyph key={i} kind={glyph} x={x} y={gy} opacity={o} />;
      })}
    </g>
  );
};

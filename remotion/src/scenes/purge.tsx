import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { Bin, EASE_IN, itemSpots } from './helpers';

/* purge — "sort into keep, donate, toss". Port of the sa-purge scene: three
   tri-tone bins, three items dropping straight down into them and fading
   (sa-drop, 3.58s, staggered 0.45s — the stagger becomes a modular phase
   shift so the loop stays seamless). The bins sit in the foreground under
   the items, so the drop is the icon's own straight fall; items render
   behind the bins and read as landing inside. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);

  const binY = 77;
  const dropY = binY - 7; // inside the bin mouth
  const stagger = 0.45 * fps;

  return (
    <g>
      {xs.map((x, i) => {
        const f = (frame - i * stagger + dur) % dur;
        // sa-drop: 0–20% at rest, lands by 55%, gone 70–100%
        const gy = kf(f, dur, [[0, y], [20, y], [55, dropY], [100, dropY]], EASE_IN);
        const o = kfLinear(f, dur, [[0, 1], [55, 1], [70, 0], [100, 0]]);
        return <Glyph key={i} kind={glyph} x={x} y={gy} opacity={o} />;
      })}
      {xs.map((x, i) => <Bin key={i} cx={x} y={binY} tone={i} />)}
    </g>
  );
};

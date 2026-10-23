import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf, kfLinear } from '../anim';
import { color, EASE, STAGE_MARGIN } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* label — "add labels". Port of the sa-label scene: a honey tag drops into
   place (sa-tag: from −14, settled by 35%, and it only pops back up at the
   loop point — that reset is the spec) while its text line breathes in and
   out (sa-fade, +0.3s phase). Two items stay put for context; the tag lands
   on the furniture's front face, per motif. */
const TAG_SPOT: Record<string, { x: number; y: number }> = {
  shelves: { x: 160, y: 54 },  // shelf-edge face below the working shelf
  drawers: { x: 134, y: 59 },  // the closed drawer's face, left of the handle
  rail: { x: 160, y: 14 },     // on the shelf above the rod
  bench: { x: 160, y: 22 },    // centered on the pegboard
  fridge: { x: 134, y: 59.5 }, // the left crisper's front
  cabinet: { x: 160, y: 46 },  // hung from the shelf edge
  undersink: { x: 192, y: 40 }, // the back wall, right of the trap
};
const TAG_H = 9;

export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);
  const spot = TAG_SPOT[motif] ?? TAG_SPOT.shelves;
  // a tag near the top of the frame drops a shorter way, so it never fades
  // in across the frame's edge
  const drop = Math.min(14, spot.y - TAG_H / 2 - 1 - STAGE_MARGIN);

  // sa-tag: hidden 14 up until 12%, settled from 35% to the end of the loop
  const tagDy = kf(frame, dur, [[0, -drop], [12, -drop], [35, 0], [100, 0]], EASE);
  const tagO = kfLinear(frame, dur, [[0, 0], [12, 0], [35, 1], [100, 1]]);
  // sa-fade with the CSS +0.3s phase shift
  const lf = (frame - 0.3 * fps + dur) % dur;
  const lineO = kfLinear(lf, dur, [[0, 0], [25, 0], [50, 1], [90, 1], [100, 0]]);

  return (
    <g>
      {[xs[0], xs[2]].map((x, i) => <Glyph key={i} kind={glyph} x={x} y={y} />)}
      <g transform={`translate(${spot.x} ${spot.y + tagDy})`} opacity={tagO}>
        <rect x={-9} y={-TAG_H / 2} width={18} height={TAG_H} rx={1.5} fill={color.honey} stroke={color.honey2} strokeWidth={2} />
        <path d="M-5 0 h10" stroke={color.honey2} strokeWidth={2} opacity={lineO} />
      </g>
    </g>
  );
};

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { PopUpRail, itemSpots } from './helpers';

/* hang — "hang things on the rod". Port of the sa-hang scene: two hung
   garments slide horizontally to their resting spots and settle, then drift
   back at the loop point (sa-hang-l/r — the return IS the spec's sway-in
   rhythm). The CSS 7px offset maps to 12 stage units. Motifs without a real
   rod (shelves, drawers) get the pop-up rail; on the bench the pegboard's
   hook row plays the rod. */
const Garment: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <Glyph kind="hanger" />
    {/* a flared dress silhouette hanging from the bar — boxes read as houses */}
    <path d="M-6 10 L-9.5 25 q-0.6 2.5 2 2.5 h15 q2.6 0 2 -2.5 L6 10 z" strokeWidth={2} />
  </g>
);

export const Scene: React.FC<SceneProps> = ({ motif }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { geo } = itemSpots(motif, 'hanger');

  // sa-hang-l / sa-hang-r: offset until 15%, settled 50–85%, back at 100%
  const dl = kf(frame, dur, [[0, 12], [15, 12], [50, 0], [85, 0], [100, 12]], EASE);
  const dr = kf(frame, dur, [[0, -12], [15, -12], [50, 0], [85, 0], [100, -12]], EASE);

  return (
    <g>
      {!geo.hasRail && <PopUpRail geo={geo} />}
      <Garment x={geo.anchorXs[0] + dl} y={geo.railY} />
      <Garment x={geo.anchorXs[2] + dr} y={geo.railY} />
    </g>
  );
};

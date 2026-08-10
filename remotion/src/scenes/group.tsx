import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* group — "pull similar items into groups". Port of the sa-group scene:
   scattered pieces converge, hold as a cluster, and release (sa-g1..g4,
   3.0s). On this wide stage four items slide along their plane into two
   tight pairs — like meeting like — instead of the icon's 2D huddle. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { y, geo } = itemSpots(motif, glyph);
  const s = geo.surfaces[geo.work];

  const spots: Array<[from: number, to: number]> = [
    [s.x1 + 26, 140 - 10],
    [160 - 14, 140 + 10],
    [160 + 14, 180 - 10],
    [s.x2 - 26, 180 + 10],
  ];

  return (
    <g>
      {spots.map(([from, to], i) => {
        // sa-g*: at rest until 15%, gathered 55–85%, released at 100%
        const x = kf(frame, dur, [[0, from], [15, from], [55, to], [85, to], [100, from]], EASE);
        return <Glyph key={i} kind={glyph} x={x} y={y} />;
      })}
    </g>
  );
};

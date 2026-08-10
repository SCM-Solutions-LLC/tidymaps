import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { kf } from '../anim';
import { color, EASE } from '../tokens';
import { Glyph } from '../glyphs';
import { SceneProps } from '../StepClip';
import { itemSpots } from './helpers';

/* fold — "fold into flat stacks". Port of the sa-fold scene: the top flap
   (primary tones) collapses down onto the stack — scaleY 1 → 0.12 about its
   bottom edge — holds flat, and springs back at the loop point (spec
   behavior). A finished stack and one neighbor item hold the scene. */
export const Scene: React.FC<SceneProps> = ({ motif, glyph }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const { xs, y } = itemSpots(motif, glyph);

  // sa-fold: upright until 20%, flat 55–85%, upright again at 100%
  const s = kf(frame, dur, [[0, 1], [20, 1], [55, 0.12], [85, 0.12], [100, 1]], EASE);
  const stackTop = y - 10; // the foldedclothes glyph is 10 tall

  return (
    <g>
      <Glyph kind="foldedclothes" x={xs[1]} y={y} />
      {/* the flap: drawn upward from its hinge at the stack top, so scaleY
          collapses it down onto the stack */}
      <g transform={`translate(${xs[1]} ${stackTop}) scale(1 ${s})`}>
        <rect x={-11} y={-14} width={22} height={14} rx={2}
          fill={color.primaryBg} stroke={color.primary} strokeWidth={2} />
      </g>
      <Glyph kind={glyph} x={xs[2]} y={y} />
    </g>
  );
};

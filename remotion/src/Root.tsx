import React from 'react';
import { Composition } from 'remotion';
import { StepClip, stepClipSchema } from './StepClip';
import { FPS, loopFrames, VIEW_H, VIEW_W } from './tokens';

/* 320×80 stage rendered at 4× (1280×320) so strokes stay crisp after the
   clip is scaled down into the ~98px-tall .step-art band. Duration follows
   the action's CSS loop length so the produced clip keeps the cadence of the
   inline scene it replaces. */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="StepClip"
    component={StepClip}
    schema={stepClipSchema}
    width={VIEW_W * 4}
    height={VIEW_H * 4}
    fps={FPS}
    durationInFrames={loopFrames('done')}
    defaultProps={{ action: 'purge' as const, motif: 'shelves' as const, glyph: 'can' as const }}
    calculateMetadata={({ props }) => ({ durationInFrames: loopFrames(props.action) })}
  />
);

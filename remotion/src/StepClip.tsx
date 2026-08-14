import React from 'react';
import { z } from 'zod';
import { Stage } from './Stage';
import { Motif } from './motifs';
import { Ambience } from './Ambience';
import { SCENES } from './scenes';

/* One parameterized composition renders every clip in the vocabulary:
   {action}-{motif}-{glyph}, mirroring js/stepMedia.js. The scene owns the
   choreography; the motif is the furniture backdrop; the glyph is the item
   the story moves. */
export const stepClipSchema = z.object({
  action: z.enum(['purge','unload','wipe','label','hang','fold','photo','contain','group','moveUp','moveDown','zones','stock','done']),
  motif: z.enum(['shelves','drawers','rail','bench']),
  glyph: z.enum(['shoe','hanger','foldedclothes','towel','jar','can','bottle','utensil','tool','tote','plate','bag']),
});
export type StepClipProps = z.infer<typeof stepClipSchema>;
export type SceneProps = { motif: string; glyph: string };

export const StepClip: React.FC<StepClipProps> = ({ action, motif, glyph }) => {
  const Scene = SCENES[action] ?? SCENES.done;
  return (
    <Stage>
      <Motif kind={motif} />
      <Ambience motif={motif} glyph={glyph} />
      <Scene motif={motif} glyph={glyph} />
    </Stage>
  );
};

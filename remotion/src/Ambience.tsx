import React from 'react';
import { color } from './tokens';
import { geoFor } from './motifs';
import { Glyph } from './glyphs';

/* The contents the story is NOT about.

   Every scene staged its one instruction on furniture that was completely
   empty — a three-shelf unit holding a single can, a pegboard with one
   hammer travelling past it. It reads as a diagram of a motion rather than
   a picture of a space, and it is the main reason the clips look thin: there
   is nothing in them except the thing that moves.

   So each surface gets a pair of quiet items at its far ends, drawn small and
   pale. They are staging, not subject: two thirds scale, 45% opacity and the
   line-2 stroke the floor uses, so they sit behind the moving item in the
   same way the furniture does.

   Placement is the load-bearing part. The choreographies work inward from
   x=110 (the leftmost bin edge under anchor 122) to x=210, so ambience sits
   8 units in from each surface's own end — x=104 and x=216 on the shelves,
   spanning ~99–109 and ~211–221 at two-thirds scale — and never collides
   with a scene it cannot see. Hangers are skipped on non-rail motifs — a garment standing on
   a shelf is a worse lie than an empty shelf. */

const EDGE = 8;    // how far in from a surface's own end an item sits
const SCALE = 0.66;
const OPACITY = 0.5;

/* What else lives in a space that holds this. Four copies of the moving item
   would make the shelf read as a warehouse of one product; a pantry holding
   cans also holds jars and packets, and a bench holding tools also holds
   totes. First entry goes to the left end of a surface, second to the right,
   so each shelf reads as a mixed shelf. */
const COMPANIONS: Record<string, [string, string]> = {
  can: ['jar', 'bag'],
  jar: ['can', 'bottle'],
  bottle: ['jar', 'tote'],
  bag: ['can', 'jar'],
  plate: ['plate', 'tote'],
  utensil: ['tote', 'utensil'],
  tool: ['tote', 'tool'],
  tote: ['tote', 'bag'],
  towel: ['towel', 'foldedclothes'],
  foldedclothes: ['towel', 'foldedclothes'],
  shoe: ['tote', 'shoe'],
  hanger: ['tote', 'shoe'],
};
const companionsFor = (glyph: string): [string, string] =>
  COMPANIONS[glyph] ?? [glyph, glyph];

export const Ambience: React.FC<{ motif: string; glyph: string }> = ({ motif, glyph }) => {
  const geo = geoFor(motif);
  const hangable = glyph === 'hanger';
  // A hanger has nothing to stand on, and the rail motif's own rod is where
  // the scene itself works — leave that one alone entirely.
  if (hangable && motif !== 'rail') return null;
  if (motif === 'rail') return null;

  const [left, right] = companionsFor(glyph);
  const spots: Array<{ x: number; y: number; kind: string }> = [];
  geo.surfaces.forEach((s) => {
    spots.push({ x: s.x1 + EDGE, y: s.y, kind: left });
    spots.push({ x: s.x2 - EDGE, y: s.y, kind: right });
  });

  return (
    <g stroke={color.line2} opacity={OPACITY}>
      {spots.map((p, i) => (
        <Glyph key={i} kind={p.kind} x={p.x} y={p.y} scale={SCALE} />
      ))}
    </g>
  );
};

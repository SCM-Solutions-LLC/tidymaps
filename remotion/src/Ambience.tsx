import React from 'react';
import { color, FLOOR_Y } from './tokens';
import { geoFor } from './motifs';
import { Glyph } from './glyphs';

/* The contents the story is NOT about.

   Every scene staged its one instruction on furniture that was completely
   empty — a three-shelf unit holding a single can, a pegboard with one
   hammer travelling past it. It reads as a diagram of a motion rather than
   a picture of a space, and it is the main reason the clips look thin: there
   is nothing in them except the thing that moves.

   So each surface gets a pair of quiet items at its far ends, drawn small and
   pale. They are staging, not subject: two thirds scale, half opacity and the
   line-2 stroke the floor uses, so they sit behind the moving item in the
   same way the furniture does.

   Placement is the load-bearing part, and it takes three rules rather than
   one, because "8 units in from the end never collides" was not true:

   1. Most choreographies work inward from x=110 (the leftmost bin edge under
      anchor 122) to x=210, so 8 units in from a surface's own end — x=104 and
      x=216 on the shelves — sits clear of them.
   2. `wipe` is the exception: its pad sweeps from x1+2 to x2-2 with the dust
      strip under it, which is the whole surface. Ambience skips the surface
      being wiped — a shelf you are cleaning is a shelf you cleared.
   3. `zones` paints opaque bands across every surface AND places its own
      items on each one, so ambience there would flash in and out from behind
      the bands. It sits that one out entirely.

   The rail motif keeps its clothes on the rod and its standing things on the
   floor beneath them, which is where a closet actually puts shoes and totes.
   Nothing ever stands a hanger on a surface: COMPANIONS only ever names
   things with feet. */

const EDGE = 8;    // how far in from a surface's own end an item sits
const SCALE = 0.66;
const OPACITY = 0.5;
const RAIL_FLOOR_X: [number, number] = [84, 236];

// draws its own contents on every surface, under opaque bands
const SKIP_ENTIRELY = new Set(['zones']);
// sweeps the full width of the plane it works on
const SKIP_WORK_SURFACE = new Set(['wipe']);

/* What else lives in a space that holds this. Four copies of the moving item
   would make the shelf read as a warehouse of one product; a pantry holding
   cans also holds jars and packets, and a bench holding tools also holds
   totes. First entry goes to the left end of a surface, second to the right,
   so each shelf reads as a mixed shelf.

   Every value is something that stands on its own — a hanger is the one glyph
   that cannot, and it is never a companion. */
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
const companionsFor = (glyph: string): [string, string] => {
  const pair = COMPANIONS[glyph] ?? [glyph, glyph];
  // never stand a hanger on a shelf: fall back to the crate that fits anywhere
  return pair.map((g) => (g === 'hanger' ? 'tote' : g)) as [string, string];
};

export const Ambience: React.FC<{ motif: string; glyph: string; action: string }> =
  ({ motif, glyph, action }) => {
    if (SKIP_ENTIRELY.has(action)) return null;

    const geo = geoFor(motif);
    const [left, right] = companionsFor(glyph);
    const spots: Array<{ x: number; y: number; kind: string }> = [];

    if (motif === 'rail') {
      /* A closet's only "surface" is the shelf over the rod, and its scenes
         work along the rod and the floor between anchors 118 and 202. The far
         ends of the floor are clear of all of them. */
      spots.push({ x: RAIL_FLOOR_X[0], y: FLOOR_Y, kind: left });
      spots.push({ x: RAIL_FLOOR_X[1], y: FLOOR_Y, kind: right });
    } else {
      geo.surfaces.forEach((s, i) => {
        if (SKIP_WORK_SURFACE.has(action) && i === geo.work) return;
        spots.push({ x: s.x1 + EDGE, y: s.y, kind: left });
        spots.push({ x: s.x2 - EDGE, y: s.y, kind: right });
      });
    }

    if (!spots.length) return null;
    return (
      <g stroke={color.line2} opacity={OPACITY}>
        {spots.map((p, i) => (
          <Glyph key={i} kind={p.kind} x={p.x} y={p.y} scale={SCALE} />
        ))}
      </g>
    );
  };

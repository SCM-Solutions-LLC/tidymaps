/* ============================================================
   Door bins: a hinged door drawn swung open, with bins on its inside.

   A fridge's door shelves and a pantry cabinet's door rack hold things on
   the inside of a door. Drawn closed, the door hides them; drawn as a board
   inside the box (what every unit builder did with a door row), they read as
   one more shelf. This module opens the door far enough that its inside
   faces the default camera and says where each bin is, so the builders draw
   the same door and the items land in the bins.

   Coordinates match the builders: x across the front, y up, z toward the
   viewer, the hinge on the front plane (z = D/2). Inches.

   Pure: no DOM, no three.js, never mutates its input.
   ============================================================ */

export const DOOR_BIN_D = 4;

/* How far each door swings. The camera stands front-left, so a door hinged
   on the right shows its inside at 115 degrees and one hinged on the left
   has to swing nearly flat to show it. */
const SWING = { left: 155, right: 115 };

/**
 * One door, swung open.
 * @param {{ role?: string, hinge: 'left'|'right', x0: number, x1: number, y0: number, y1: number, bins: number, rows?: any[] }} spec
 */
export function openDoor(spec) {
  const angle = SWING[spec.hinge] * Math.PI / 180;
  const left = spec.hinge === 'left';
  const width = spec.x1 - spec.x0;
  const span = spec.y1 - spec.y0;
  const bins = Math.max(1, Math.round(spec.bins));
  return {
    ...spec, width, angle, bins,
    hingeX: left ? spec.x0 : spec.x1,
    /* Closed, a left-hinged door runs +x from its hinge and its inside faces
       -z (into the box). Swung by `angle` its far edge comes toward the
       viewer; a right-hinged door mirrors it. */
    run: left ? { x: Math.cos(angle), z: Math.sin(angle) } : { x: -Math.cos(angle), z: Math.sin(angle) },
    inward: left ? { x: Math.sin(angle), z: -Math.cos(angle) } : { x: -Math.sin(angle), z: -Math.cos(angle) },
    binYs: Array.from({ length: bins }, (_, b) => spec.y1 - span * (0.18 + 0.64 * (bins === 1 ? 0.5 : b / (bins - 1))) - 2),
    binH: Math.max(3, Math.min(8, span * 0.64 / bins - 1)),
  };
}

/* Rows spread over the bins, top to bottom: one row takes the middle bin,
   two or more spread to the ends. Same spread as a room's wall. */
export function binOf(t, k, bins) {
  if (k <= 1) return Math.floor((bins - 1) / 2);
  return Math.round(t * (bins - 1) / (k - 1));
}

/* One door bin as a surface: where it sits once the door has swung, which
   way it faces (normal, the door's inside) and which way its items run
   (uDir, chosen so their fronts face the normal: surfaceMath turns +x into
   uDir and an item's front, +z, lands on (-u.z, u.x)).
   @param {number} index @param {ReturnType<typeof openDoor>} d @param {number} b @param {number} hz  the front plane */
export function doorSlot(index, d, b, hz) {
  const half = d.width / 2;
  const off = DOOR_BIN_D / 2 + 1.2;
  return {
    index, part: 'door', kind: 'door', door: d.role, hinge: d.hinge, bin: b,
    x: d.hingeX + d.run.x * half + d.inward.x * off,
    y: d.binYs[b],
    z: hz + d.run.z * half + d.inward.z * off,
    length: Math.max(4, d.width - 4), gap: d.binH, depth: DOOR_BIN_D,
    uDir: { x: d.inward.z, y: 0, z: -d.inward.x },
    normal: { x: d.inward.x, y: 0, z: d.inward.z },
  };
}

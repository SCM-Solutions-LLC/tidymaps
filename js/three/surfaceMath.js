/* Shared, Three.js-free math for placing and dragging items on any layout
   surface. Keeping this pure makes the orientation contract unit-testable. */

export const ITEM_NORMAL_OFFSET = 0.375;

function vector(value, fallback) {
  return value || fallback;
}

export function surfaceCenter(surface) {
  return surface.center || (surface.hitbox && surface.hitbox.position) || { x: 0, y: 0, z: 0 };
}

export function pointOnSurface(surface, offset, normalOffset = 0) {
  const center = surfaceCenter(surface);
  const u = vector(surface.uDir, { x: 1, y: 0, z: 0 });
  const normal = vector(surface.normal, { x: 0, y: 0, z: 1 });
  return {
    x: center.x + u.x * offset + normal.x * normalOffset,
    y: center.y + u.y * offset + normal.y * normalOffset,
    z: center.z + u.z * offset + normal.z * normalOffset,
  };
}

export function surfaceOffsetForPoint(point, surface) {
  const center = surfaceCenter(surface);
  const u = vector(surface.uDir, { x: 1, y: 0, z: 0 });
  return (point.x - center.x) * u.x
    + (point.y - center.y) * u.y
    + (point.z - center.z) * u.z;
}

export function clampSurfaceOffset(offset, length, itemWidth) {
  const half = Math.max(0, (Number(length) - Number(itemWidth)) / 2);
  return Math.max(-half, Math.min(half, offset));
}

export function surfaceRotationY(surface) {
  const u = vector(surface.uDir, { x: 1, y: 0, z: 0 });
  return Math.atan2(-u.z, u.x);
}

export function itemYForSurface(surface, itemHeight, lift = 0) {
  const y = Number(surface.y) || 0;
  const halfHeight = Number(itemHeight) / 2;
  if (surface.kind === 'pegboard') return surfaceCenter(surface).y + lift;
  return surface.kind === 'rod' ? y - halfHeight + lift : y + halfHeight + lift;
}

/* ---------- how a shelf's representative copies are arranged ----------

   A shelf's contents used to be one row: every copy at the same depth, the
   same yaw, evenly spaced. Three identical fronts in a line reads as a
   display fixture rather than a stocked shelf, and it wastes the depth the
   plan actually measured.

   These two functions decide the arrangement, and they live here rather than
   in scene.js because they are pure placement math — the same reason
   pointOnSurface does. */

/* How far behind the front rank a second rank can sit, in world inches, or 0
   when it cannot. Zero means the caller lays out one row exactly as before.

   Refuses in the cases where a second rank would be wrong rather than merely
   tight: inside an organizer the bin decides the arrangement, a rod hangs its
   contents in one plane, and a pegboard has no depth to use. */
export function depthRankStep({
  surface = {}, shelfDepth, itemDepth, unitCount, inOrganizer = false,
  minSlackRatio = 0.55, maxStepRatio = 0.92,
} = {}) {
  const depth = Number(itemDepth);
  const shelf = Number(shelfDepth);
  if (!(depth > 0) || !(shelf > 0)) return 0;
  if (inOrganizer || Number(unitCount) < 2) return 0;
  if (surface.kind === 'rod' || surface.kind === 'pegboard') return 0;
  /* Room behind a front-rank item before its back face leaves the shelf. */
  const slack = shelf / 2 + ITEM_NORMAL_OFFSET - depth;
  if (slack < depth * minSlackRatio) return 0;
  return Math.min(depth * maxStepRatio, slack);
}

/* A stable pseudo-random pair in -1..1 for one copy of one item.

   Deterministic on purpose. Math.random() here would make two renders of the
   same plan differ, which costs the one thing this repo checks appearance
   with — a screenshot — and turns any pixel assertion into a coin flip. The
   same item in the same slot wobbles the same way every time. */
/* FNV-1a. Shared so that everything generated from an item's identity — its
   wobble here, its packaging label in scene.js — varies together and repeats
   exactly. */
export function hashString(text) {
  let hash = 2166136261;
  const s = String(text == null ? '' : text);
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function displayJitter(key, index) {
  const hash = hashString(`${key == null ? '' : key}#${index}`);
  return {
    yaw: ((hash & 0xffff) / 32767.5) - 1,
    depth: (((hash >>> 16) & 0xffff) / 32767.5) - 1,
  };
}


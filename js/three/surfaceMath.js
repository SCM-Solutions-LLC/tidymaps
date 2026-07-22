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

/**
 * Camera framing, pure maths (no three.js): a fixed three-quarter view that fits the whole map on
 * wide screens, and a closer one that follows you on portrait phones (GAME_PLAN.md §10).
 */
export type Vec3 = readonly [number, number, number];
export type Framing = { readonly from: Vec3; readonly at: Vec3; readonly fov: number };

/** Pitch of the three-quarter view, from the horizontal. */
export const PITCH_DEG = 62;
export const FOV = 34;

/** Portrait screens (taller than wide) follow the player. */
export function isPortrait(width: number, height: number): boolean {
  return height > width * 1.05;
}

/**
 * Distance at which a box of `w` × `d` tiles (plus a margin) fits a view of the given aspect,
 * looking down at `PITCH_DEG` with a vertical field of view `fov`.
 */
export function fitDistance(w: number, d: number, aspect: number, fov = FOV): number {
  const pitch = (PITCH_DEG * Math.PI) / 180;
  const half = (fov * Math.PI) / 360;
  // Depth seen on screen shrinks by sin(pitch); width needs the horizontal half-angle.
  const needV = (d * Math.sin(pitch) + 1.6 * Math.cos(pitch)) / 2 / Math.tan(half);
  const needH = w / 2 / (Math.tan(half) * aspect);
  return Math.max(needV, needH) * 1.08 + 1.2;
}

/** The whole map: centre at the middle of the floor (tile coordinates → world x, z). */
export function overviewFraming(cols: number, rows: number, aspect: number): Framing {
  const cx = (cols - 1) / 2;
  const cz = (rows - 1) / 2;
  const dist = fitDistance(cols + 1, rows + 1, aspect);
  const pitch = (PITCH_DEG * Math.PI) / 180;
  return {
    at: [cx, 0, cz + 0.3],
    from: [cx, Math.sin(pitch) * dist, cz + 0.3 + Math.cos(pitch) * dist],
    fov: FOV,
  };
}

/** Following a point on a portrait phone: about 7 tiles across, clamped inside the map. */
export function followFraming(
  x: number,
  z: number,
  cols: number,
  rows: number,
  aspect: number,
): Framing {
  const across = 8;
  const half = (FOV * Math.PI) / 360;
  const dist = across / 2 / (Math.tan(half) * aspect) + 0.5;
  const pitch = (62 * Math.PI) / 180;
  const margin = Math.min(across / 2 - 1.5, (cols - 1) / 2);
  const cx = Math.min(Math.max(x, margin), cols - 1 - margin);
  const cz = Math.min(Math.max(z, 1.5), rows - 2.5);
  return {
    at: [cx, 0, cz + 0.4],
    from: [cx, Math.sin(pitch) * dist, cz + 0.4 + Math.cos(pitch) * dist],
    fov: FOV,
  };
}

/** The end-of-match highlight (board 4): down close over the push, the only time the camera moves in. */
export function closeFraming(x: number, z: number): Framing {
  return { at: [x, 0.3, z + 0.2], from: [x - 0.6, 3.4, z + 3.6], fov: 42 };
}

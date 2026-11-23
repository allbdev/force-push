/**
 * Where things are drawn, from the state: tile coordinates as floats (x right, y down), the
 * player's step progress turned into a fraction of a tile. Pure, no three.js.
 */
import { DX, DY } from "../core/map";
import { stepTicks, type Player } from "../core/state";

export type Point = { x: number; y: number };

export function playerPoint(p: Player): Point {
  if (p.dir === -1 || p.progress === 0) return { x: p.x, y: p.y };
  const f = Math.min(1, p.progress / stepTicks(p));
  return { x: p.x + DX[p.dir]! * f, y: p.y + DY[p.dir]! * f };
}

/** Linear blend between two points; snaps when they're more than a tile apart (a respawn). */
export function blend(a: Point, b: Point, alpha: number): Point {
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1.5) return { x: b.x, y: b.y };
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

/** Walk cycle phase in [0, 1): one full cycle every two tiles. */
export function walkPhase(point: Point, moving: boolean): number {
  if (!moving) return 0;
  const d = point.x + point.y;
  return (((d / 2) % 1) + 1) % 1;
}

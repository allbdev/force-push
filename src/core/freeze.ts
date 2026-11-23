/**
 * Code freeze (GAME_PLAN.md §6.6, second version): in the last `freezeTicks` the outer ring closes
 * tile by tile, clockwise from the north-west corner, finishing as the sprint ends. A closed tile
 * is a wall and counts for nobody; standing on it as it closes reverts you.
 */
import { RULES } from "../content/rules";
import { paint } from "./blast";
import { FROZEN, RACK } from "./map";
import { revert } from "./revert";
import { effectiveTile, inPlay, type GameState } from "./state";

/** The outer ring's tiles, clockwise from the north-west corner, racks left out. */
export function freezeRing(s: Pick<GameState, "width" | "height" | "kind">): number[] {
  const { width: w, height: h } = s;
  const ring: number[] = [];
  for (let x = 0; x < w; x++) ring.push(x);
  for (let y = 1; y < h; y++) ring.push(y * w + w - 1);
  for (let x = w - 2; x >= 0; x--) ring.push((h - 1) * w + x);
  for (let y = h - 2; y >= 1; y--) ring.push(y * w);
  return ring.filter((i) => s.kind[i] !== RACK);
}

export function freezeEvery(ringLength: number): number {
  return Math.max(1, Math.floor(RULES.freezeTicks / Math.max(1, ringLength)));
}

/** The tick the freeze starts on. */
export function freezeStart(s: GameState): number {
  return s.endTick - RULES.freezeTicks;
}

export function tickFreeze(s: GameState): void {
  if (!s.freeze) return;
  const ring = freezeRing(s);
  const every = freezeEvery(ring.length);
  const since = s.tick - freezeStart(s);
  if (since < 0 || s.frozen >= ring.length) return;
  if (since < (s.frozen + 1) * every) return;
  const i = ring[s.frozen]!;
  s.frozen += 1;
  s.kind[i] = FROZEN;
  s.item[i] = 0;
  s.hidden[i] = 0;
  s.blast[i] = 0;
  paint(s, i, 0);
  const x = i % s.width;
  const y = (i - x) / s.width;
  const push = s.pushes.findIndex((q) => q.x === x && q.y === y);
  if (push >= 0) s.pushes.splice(push, 1);
  s.events.push({ type: "freeze", x, y });
  s.players.forEach((p, seat) => {
    if (inPlay(p) && effectiveTile(s, p) === i) revert(s, seat, seat, i);
  });
}

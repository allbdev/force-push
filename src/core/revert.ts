/**
 * Reverts, respawns and power-ups (GAME_PLAN.md §6.3–§6.4). Caught by a blast you're out for
 * `revertTicks`; your `penaltyTiles` nearest tiles go to whoever reverted you (grey if nobody did);
 * you come back at your desk with `graceTicks` of grace. A rubber duck absorbs one blast.
 */
import { RULES } from "../content/rules";
import { powerUpFromCode } from "../content/power-ups";
import { DX, DY, FLOOR } from "./map";
import { paint } from "./blast";
import { effectiveTile, inPlay, pushAt, type GameState } from "./state";

export function revert(s: GameState, seat: number, by: number, at: number): void {
  const p = s.players[seat]!;
  const fx = at % s.width;
  const fy = (at - fx) / s.width;
  p.out = RULES.revertTicks;
  p.dir = -1;
  p.progress = 0;
  p.grace = 0;
  p.fellX = fx;
  p.fellY = fy;
  p.revertedBy = by === seat ? -1 : by;
  s.stats.reverted[seat]! += 1;
  s.events.push({ type: "revert", seat, by: p.revertedBy, x: fx, y: fy });

  // The penalty: the victim's nearest tiles (squared distance, then index) change hands.
  const mine: number[] = [];
  for (let i = 0; i < s.owner.length; i++) if (s.owner[i] === seat + 1) mine.push(i);
  const dist = (i: number) => {
    const x = i % s.width;
    const y = (i - x) / s.width;
    return (x - fx) * (x - fx) + (y - fy) * (y - fy);
  };
  mine.sort((a, b) => dist(a) - dist(b) || a - b);
  const to = p.revertedBy === -1 ? 0 : p.revertedBy + 1;
  for (const i of mine.slice(0, RULES.penaltyTiles)) paint(s, i, to);
}

/** Players standing in a live blast are reverted (or lose their duck). */
export function applyHits(s: GameState): void {
  s.players.forEach((p, seat) => {
    if (!inPlay(p) || p.grace > 0) return;
    const i = effectiveTile(s, p);
    if (s.blast[i] === 0) return;
    if (p.duck) {
      p.duck = 0;
      p.grace = RULES.graceTicks;
      s.events.push({ type: "duck", seat });
      return;
    }
    revert(s, seat, s.blastSeat[i]!, i);
  });
}

/** The open floor tile nearest the desk (the desk itself unless the freeze closed it). */
export function spawnTile(s: GameState, seat: number): number {
  const start = s.desks[seat]!;
  if (s.kind[start] === FLOOR) return start;
  const seen = new Uint8Array(s.kind.length);
  seen[start] = 1;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % s.width;
    const y = (i - x) / s.width;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      const j = ny * s.width + nx;
      if (seen[j]) continue;
      seen[j] = 1;
      if (s.kind[j] === FLOOR) return j;
      queue.push(j);
    }
  }
  return start;
}

/** Counts down timers; brings reverted players back at their desk with grace. */
export function tickTimers(s: GameState): void {
  s.players.forEach((p, seat) => {
    if (p.coffee > 0) p.coffee -= 1;
    if (p.grace > 0) p.grace -= 1;
    if (p.out > 0) {
      p.out -= 1;
      if (p.out === 0) {
        const i = spawnTile(s, seat);
        p.x = i % s.width;
        p.y = (i - p.x) / s.width;
        p.dir = -1;
        p.progress = 0;
        p.grace = RULES.graceTicks;
        p.facing = 2;
        const push = pushAt(s, i);
        if (push) push.pass |= 1 << seat;
        s.events.push({ type: "respawn", seat });
      }
    }
  });
}

/** Players pick up the power-up on the tile they count as standing on. */
export function applyPickups(s: GameState): void {
  s.players.forEach((p, seat) => {
    if (!inPlay(p)) return;
    const i = effectiveTile(s, p);
    const kind = powerUpFromCode(s.item[i]!);
    if (!kind) return;
    switch (kind) {
      case "coffee":
        p.coffee = RULES.coffeeTicks;
        break;
      case "duck":
        p.duck = 1;
        break;
      case "stackOverflow":
        p.range = Math.min(RULES.maxRange, p.range + 1);
        break;
      case "secondMonitor":
        p.carry = Math.min(RULES.maxCarry, p.carry + 1);
        break;
      case "rebase":
        p.rebase = 1;
        break;
    }
    s.events.push({ type: "pickup", seat, kind: s.item[i]! });
    s.item[i] = 0;
  });
}

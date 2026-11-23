/**
 * Force-pushes and blasts (GAME_PLAN.md §6.2). A push goes on the tile you count as standing on,
 * burns for `fuseTicks`, then blasts in a cross. Each arm stops before a rack (rebase passes one),
 * or on the first box it hits (the box breaks). Every floor tile a blast reaches is painted in the
 * owner's colour and stays dangerous for `blastTicks`. A blast that reaches another push sets it
 * off on the next tick.
 */
import { RULES } from "../content/rules";
import { bounceFrom } from "./movement";
import { BOX, DX, DY, FLOOR, FROZEN, RACK, type Dir } from "./map";
import { effectiveTile, inPlay, pushAt, type GameState, type Push } from "./state";

/** Paints tile `i` for `owner` (0 grey, 1 + seat) and keeps the diff: `+` minus `−` = owned. */
export function paint(s: GameState, i: number, owner: number): void {
  const old = s.owner[i]!;
  if (old === owner) return;
  if (old > 0) s.minus[old - 1]! += 1;
  if (owner > 0) s.plus[owner - 1]! += 1;
  s.owner[i] = owner;
}

export function pushesOf(s: GameState, seat: number): number {
  let n = 0;
  for (const q of s.pushes) if (q.owner === seat) n++;
  return n;
}

/** Drops a push for `seat` if they can: in play, under their carry limit, on a free tile. */
export function tryDrop(s: GameState, seat: number): boolean {
  const p = s.players[seat]!;
  if (!inPlay(p) || pushesOf(s, seat) >= p.carry) return false;
  const i = effectiveTile(s, p);
  if (s.kind[i] !== FLOOR || pushAt(s, i)) return false;
  const x = i % s.width;
  const y = (i - x) / s.width;
  const push: Push = {
    id: s.nextPushId++,
    owner: seat,
    x,
    y,
    fuse: RULES.fuseTicks,
    age: 0,
    range: p.range,
    rebase: p.rebase,
    pass: 0,
  };
  p.rebase = 0;
  s.pushes.push(push);
  claimTile(s, push);
  s.stats.pushes[seat]! += 1;
  s.events.push({ type: "push", seat, x, y });
  return true;
}

/** Whoever stands on the push's tile may leave it; whoever is only heading there is stopped. */
function claimTile(s: GameState, push: Push): void {
  const i = push.y * s.width + push.x;
  push.pass = 0;
  s.players.forEach((p, seat) => {
    if (!inPlay(p)) return;
    if (effectiveTile(s, p) === i) push.pass |= 1 << seat;
    else bounceFrom(s, seat, i);
  });
}

/** Forgets players who have left a push's tile: they can't walk back onto it. */
export function releasePasses(s: GameState): void {
  for (const q of s.pushes) {
    if (q.pass === 0) continue;
    const i = q.y * s.width + q.x;
    s.players.forEach((p, seat) => {
      if (q.pass & (1 << seat) && (!inPlay(p) || effectiveTile(s, p) !== i)) q.pass &= ~(1 << seat);
    });
  }
}

/** The tiles a push at (x, y) would reach, in order, without changing anything. */
export function blastTiles(
  s: GameState,
  x: number,
  y: number,
  range: number,
  rebase: boolean,
): number[] {
  const tiles = [y * s.width + x];
  for (let d = 0; d < 4; d++) {
    let passed = false;
    for (let k = 1; k <= range; k++) {
      const tx = x + DX[d]! * k;
      const ty = y + DY[d]! * k;
      if (tx < 0 || ty < 0 || tx >= s.width || ty >= s.height) break;
      const i = ty * s.width + tx;
      const kind = s.kind[i]!;
      if (kind === RACK) {
        if (rebase && !passed) {
          passed = true;
          continue;
        }
        break;
      }
      if (kind === FROZEN) break;
      tiles.push(i);
      if (kind === BOX) break;
    }
  }
  return tiles;
}

/** Sets a push off now: paints, breaks boxes, reveals power-ups, chains other pushes. */
export function explode(s: GameState, push: Push): void {
  s.pushes.splice(s.pushes.indexOf(push), 1);
  const owner = push.owner + 1;
  let gained = 0;
  let taken = 0;
  for (const i of blastTiles(s, push.x, push.y, push.range, push.rebase === 1)) {
    const x = i % s.width;
    const y = (i - x) / s.width;
    if (s.kind[i] === BOX) {
      s.kind[i] = FLOOR;
      s.stats.boxes[push.owner]! += 1;
      s.events.push({ type: "box", seat: push.owner, x, y });
      if (s.hidden[i]) {
        s.item[i] = s.hidden[i]!;
        s.hidden[i] = 0;
        s.events.push({ type: "drop", x, y, kind: s.item[i]! });
      }
    }
    const other = pushAt(s, i);
    if (other && other.fuse > 1) other.fuse = 1;
    if (s.owner[i] !== owner) {
      gained++;
      if (s.owner[i]! > 0) taken++;
    }
    paint(s, i, owner);
    s.blast[i] = RULES.blastTicks;
    s.blastSeat[i] = push.owner;
  }
  if (gained > s.stats.bestGain) {
    s.stats.bestGain = gained;
    s.stats.bestSeat = push.owner;
  }
  s.events.push({ type: "blast", seat: push.owner, x: push.x, y: push.y, gained, taken });
}

/** One tick of every push: wind, fuses, and the blasts that are due (oldest first). */
export function tickPushes(s: GameState): void {
  const wind = s.wind;
  for (let i = 0; i < s.blast.length; i++) if (s.blast[i]! > 0) s.blast[i]! -= 1;
  for (const q of s.pushes) {
    q.age += 1;
    q.fuse -= 1;
    if (wind && q.age === wind.delay) blowPush(s, q, wind.dir);
  }
  const due = s.pushes.filter((q) => q.fuse <= 0).sort((a, b) => a.id - b.id);
  for (const q of due) explode(s, q);
}

/** Wind moves a push one tile, if that tile is free floor with nobody on it. */
function blowPush(s: GameState, q: Push, dir: Dir): void {
  const tx = q.x + DX[dir]!;
  const ty = q.y + DY[dir]!;
  if (tx < 0 || ty < 0 || tx >= s.width || ty >= s.height) return;
  const i = ty * s.width + tx;
  if (s.kind[i] !== FLOOR || pushAt(s, i)) return;
  if (s.players.some((p) => inPlay(p) && effectiveTile(s, p) === i)) return;
  q.x = tx;
  q.y = ty;
  claimTile(s, q);
}

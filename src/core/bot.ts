/**
 * Bots (GAME_PLAN.md §6.7): they read only the state and return the same five input bits a
 * player sends, so they run identically on the server, in a local room and in a replay. No hidden
 * memory: randomness comes from `hash32(seed, tick, seat)`.
 *
 * Each decision: build a danger map (when each tile will be inside a blast), flee if standing in
 * danger, otherwise score the tiles in reach (boxes and other branches' tiles a push there would
 * paint, power-ups, rivals in the cross) and walk to the best one. A push is dropped only when a
 * safe tile can be reached before it goes off.
 */
import { BOT, type BotWeights } from "../content/bots";
import { RULES } from "../content/rules";
import { blastTiles, pushesOf } from "./blast";
import { BOX, DX, DY, FLOOR, type Dir } from "./map";
import { hash32 } from "./rng";
import {
  DIR_BITS,
  effectiveTile,
  IN_PUSH,
  inPlay,
  stepTicks,
  type GameState,
  type Player,
} from "./state";

const NEVER = 0x3fffffff;

/**
 * Danger windows per tile: the first tick (from now) a blast will cover it, and the last.
 * Live blasts count from 0. Chains are followed (a push in a blast goes off one tick later).
 */
export type Danger = { readonly from: Int32Array; readonly to: Int32Array };

export function dangerMap(s: GameState): Danger {
  const n = s.kind.length;
  const from = new Int32Array(n).fill(NEVER);
  const to = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (s.blast[i]! > 0) {
      from[i] = 0;
      to[i] = s.blast[i]!;
    }
  }
  const pushes = s.pushes;
  const when = pushes.map((q) => Math.max(1, q.fuse));
  const reach = pushes.map((q) => blastTiles(s, q.x, q.y, q.range, q.rebase === 1));
  for (let changed = true, guard = 0; changed && guard < 32; guard++) {
    changed = false;
    pushes.forEach((q, a) => {
      pushes.forEach((r, b) => {
        if (a === b || when[a]! + 1 >= when[b]!) return;
        if (reach[a]!.includes(r.y * s.width + r.x)) {
          when[b] = when[a]! + 1;
          changed = true;
        }
      });
    });
  }
  pushes.forEach((_, a) => {
    for (const i of reach[a]!) {
      from[i] = Math.min(from[i]!, when[a]!);
      to[i] = Math.max(to[i]!, when[a]! + RULES.blastTicks);
    }
  });
  return { from, to };
}

/** Is a tile dangerous at any time in [t0, t1]? */
function hot(d: Danger, i: number, t0: number, t1: number): boolean {
  return d.from[i]! <= t1 + 1 && d.to[i]! >= t0 - 1;
}

function passable(s: GameState, seat: number, i: number, pushTiles: Uint8Array): boolean {
  if (s.kind[i] !== FLOOR) return false;
  if (pushTiles[i]) {
    const q = s.pushes.find((p) => p.y * s.width + p.x === i);
    return !!q && (q.pass & (1 << seat)) !== 0;
  }
  return true;
}

type Search = {
  /** Steps from the start, -1 when unreached. */
  dist: Int16Array;
  /** The first direction taken from the start to get here. */
  first: Int8Array;
  order: number[];
};

/**
 * Breadth-first over tiles that can be walked through safely: a tile is entered only if no blast
 * covers it while we'd be on it. `extra` marks tiles to treat as dangerous from `extraAt` on (a
 * push we're thinking of dropping).
 */
function search(
  s: GameState,
  seat: number,
  start: number,
  d: Danger,
  ticks: number,
  pushTiles: Uint8Array,
  extra: readonly number[] | null,
  extraAt: number,
): Search {
  const n = s.kind.length;
  const dist = new Int16Array(n).fill(-1);
  const first = new Int8Array(n).fill(-1);
  const extraSet = extra ? new Set(extra) : null;
  dist[start] = 0;
  const order = [start];
  for (let head = 0; head < order.length; head++) {
    const i = order[head]!;
    const x = i % s.width;
    const y = (i - x) / s.width;
    const k = dist[i]! + 1;
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DX[dir]!;
      const ny = y + DY[dir]!;
      if (nx < 0 || ny < 0 || nx >= s.width || ny >= s.height) continue;
      const j = ny * s.width + nx;
      if (dist[j] !== -1 || !passable(s, seat, j, pushTiles)) continue;
      const t0 = (k - 1) * ticks;
      const t1 = (k + 1) * ticks;
      if (hot(d, j, t0, t1)) continue;
      if (extraSet?.has(j) && t1 >= extraAt - 1) {
        // Inside the planned blast: fine to pass through before it goes off, never to linger.
        if (t1 + ticks >= extraAt) continue;
      }
      dist[j] = k;
      first[j] = head === 0 ? dir : first[i]!;
      order.push(j);
    }
  }
  return { dist, first, order };
}

/** A tile that is safe to stay on for good. */
function restful(d: Danger, i: number, extra: Set<number> | null): boolean {
  return d.from[i] === NEVER && !(extra?.has(i) ?? false);
}

/** How much a push dropped on tile `i` is worth to `seat`. */
function pushValue(s: GameState, seat: number, i: number, range: number, w: BotWeights): number {
  const x = i % s.width;
  const y = (i - x) / s.width;
  let v = 0;
  for (const t of blastTiles(s, x, y, range, false)) {
    if (s.kind[t] === BOX) v += w.box;
    const o = s.owner[t]!;
    if (o === 0) v += w.grey;
    else if (o !== seat + 1) v += w.rival;
    s.players.forEach((p, other) => {
      if (other !== seat && inPlay(p) && p.grace === 0 && effectiveTile(s, p) === t) v += w.player;
    });
  }
  return v;
}

function dirBits(dir: number): number {
  return dir >= 0 ? DIR_BITS[dir]! : 0;
}

/** The five input bits the bot in `seat` sends this tick. */
export function botInput(s: GameState, seat: number, weights: BotWeights = BOT): number {
  const p = s.players[seat]!;
  if (!inPlay(p) || s.ended) return 0;
  // Mid-step: keep walking (the step finishes in a few ticks).
  if (p.dir !== -1 && p.progress > 0) return dirBits(p.dir);
  return decide(s, seat, p, weights);
}

function decide(s: GameState, seat: number, p: Player, w: BotWeights): number {
  const start = p.y * s.width + p.x;
  const ticks = stepTicks(p);
  const d = dangerMap(s);
  const pushTiles = new Uint8Array(s.kind.length);
  for (const q of s.pushes) pushTiles[q.y * s.width + q.x] = 1;
  const reach = search(s, seat, start, d, ticks, pushTiles, null, 0);

  // 1. Standing in a coming blast: go to the nearest tile that stays safe.
  if (d.from[start]! !== NEVER) {
    let best = -1;
    for (const i of reach.order) {
      if (restful(d, i, null)) {
        best = i;
        break;
      }
    }
    if (best >= 0 && best !== start) return dirBits(reach.first[best]!);
    // Nowhere safe: step to whichever reachable tile is hit latest.
    let latest = start;
    for (const i of reach.order) if (d.from[i]! > d.from[latest]!) latest = i;
    return latest === start ? 0 : dirBits(reach.first[latest]!);
  }

  // 2. Score every reachable tile.
  const canDrop = pushesOf(s, seat) < p.carry && !pushTiles[start];
  type Option = { i: number; score: number; value: number };
  const options: Option[] = [];
  for (const i of reach.order) {
    if (!restful(d, i, null)) continue;
    const k = reach.dist[i]!;
    const value = canDrop ? pushValue(s, seat, i, p.range, w) : 0;
    const item = s.item[i] ? w.powerUp : 0;
    const noise = (hash32(s.seed, s.tick >> 4, seat, i) % 1000) / 1000;
    options.push({ i, value, score: value + item - k * w.distance + noise * w.noise });
  }
  options.sort((a, b) => b.score - a.score || a.i - b.i);

  for (const o of options.slice(0, 8)) {
    if (o.i === start) {
      if (o.value < w.minValue || !canDrop) continue;
      const escape = escapeAfterDrop(s, seat, p, start, d, ticks, pushTiles);
      if (escape === null) continue;
      if (p.prevInput & IN_PUSH) return 0; // release first, press next tick
      return IN_PUSH | dirBits(escape);
    }
    if (s.item[o.i] || o.value >= w.minValue) return dirBits(reach.first[o.i]!);
  }
  // Nothing worth doing nearby: drift toward the centre of the map.
  const centre = (s.height >> 1) * s.width + (s.width >> 1);
  let bestTile = -1;
  let bestDist = NEVER;
  for (const i of reach.order) {
    if (!restful(d, i, null)) continue;
    const cx = (i % s.width) - (centre % s.width);
    const cy = Math.floor(i / s.width) - Math.floor(centre / s.width);
    const dd = Math.abs(cx) + Math.abs(cy);
    if (dd < bestDist) {
      bestDist = dd;
      bestTile = i;
    }
  }
  return bestTile >= 0 && bestTile !== start ? dirBits(reach.first[bestTile]!) : 0;
}

/** Where to run after dropping a push here, or null if there's no way out in time. */
function escapeAfterDrop(
  s: GameState,
  seat: number,
  p: Player,
  start: number,
  d: Danger,
  ticks: number,
  pushTiles: Uint8Array,
): Dir | null {
  const x = start % s.width;
  const y = (start - x) / s.width;
  const planned = blastTiles(s, x, y, p.range, p.rebase === 1);
  const fuse = RULES.fuseTicks;
  const reach = search(s, seat, start, d, ticks, pushTiles, planned, fuse);
  const plannedSet = new Set(planned);
  const margin = ticks * 2;
  for (const i of reach.order) {
    if (i === start) continue;
    if (!restful(d, i, plannedSet)) continue;
    if (reach.dist[i]! * ticks + margin > fuse) continue;
    return reach.first[i]! as Dir;
  }
  return null;
}

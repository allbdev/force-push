/**
 * The match state: integers and typed arrays only, so it clones cheaply, hashes the same in every
 * engine and travels as a snapshot. `step` (src/core/step.ts) is the only thing that changes it.
 */
import { BRANCHES } from "../content/branches";
import { RULES } from "../content/rules";
import { FLOOR, layoutFor, type Dir, type MapDef, type Wind } from "./map";
import { seedRng } from "./rng";

/** Bump when a rule change would make an old replay play differently. */
export const SIM_VERSION = 1;

export const SEATS = BRANCHES.length;

/** Input bits: four directions and the push button. Five bits is all a client ever sends. */
export const IN_UP = 1;
export const IN_RIGHT = 2;
export const IN_DOWN = 4;
export const IN_LEFT = 8;
export const IN_PUSH = 16;
export const INPUT_MASK = 31;
export const DIR_BITS: readonly number[] = [IN_UP, IN_RIGHT, IN_DOWN, IN_LEFT];

export type Player = {
  /** The tile being left (or stood on). */
  x: number;
  y: number;
  /** Moving direction, or -1 when standing still. */
  dir: Dir | -1;
  /** Ticks into the current step (0 at a tile centre). */
  progress: number;
  facing: Dir;
  /** The most recently pressed direction (corner rule). */
  pref: Dir | -1;
  prevInput: number;
  range: number;
  carry: number;
  /** Ticks of coffee left. */
  coffee: number;
  duck: number;
  /** The next push repaints through one rack. */
  rebase: number;
  /** Ticks left out of play after a revert (0 = in play), or `CLOSED` for a seat nobody plays. */
  out: number;
  grace: number;
  /** Where the player fell, and who reverted them (seat, or -1 for nobody: self or freeze). */
  fellX: number;
  fellY: number;
  revertedBy: number;
};

export type Push = {
  id: number;
  owner: number;
  x: number;
  y: number;
  /** Ticks until it goes off. */
  fuse: number;
  /** Ticks since it was dropped (for wind). */
  age: number;
  range: number;
  rebase: number;
  /** Seats allowed to stand on its tile: those on it when it was dropped, until they leave. */
  pass: number;
};

export type GameEvent =
  | { readonly type: "push"; readonly seat: number; readonly x: number; readonly y: number }
  | {
      readonly type: "blast";
      readonly seat: number;
      readonly x: number;
      readonly y: number;
      /** Tiles that became the owner's colour, and how many of those were someone else's. */
      readonly gained: number;
      readonly taken: number;
    }
  | { readonly type: "box"; readonly seat: number; readonly x: number; readonly y: number }
  | { readonly type: "drop"; readonly x: number; readonly y: number; readonly kind: number }
  | { readonly type: "pickup"; readonly seat: number; readonly kind: number }
  | {
      readonly type: "revert";
      readonly seat: number;
      /** The seat whose blast did it, or -1 (self or the freeze). */
      readonly by: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: "duck"; readonly seat: number }
  | { readonly type: "respawn"; readonly seat: number }
  | { readonly type: "freeze"; readonly x: number; readonly y: number }
  | { readonly type: "end" };

export type Stats = {
  /** Per seat. */
  pushes: number[];
  reverted: number[];
  boxes: number[];
  /** The single biggest blast: seat and tiles gained (-1 when none yet). */
  bestSeat: number;
  bestGain: number;
};

/** `Player.out` for a closed seat: no developer, no desk, no share, for the whole match. */
export const CLOSED = -1;

export type MatchSetup = {
  readonly map: MapDef;
  readonly seed: number;
  /** Sprint length in ticks. */
  readonly ticks: number;
  /** Code freeze in the last 30 s (second version). */
  readonly freeze?: boolean;
  /** Closed seats, one bit per seat (bit 0 = main). Nobody plays them, not even a bot. */
  readonly closed?: number;
};

export type GameState = {
  readonly version: number;
  readonly mapId: string;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly freeze: boolean;
  /** Each seat's desk tile, and the map's wind (rooftop). */
  readonly desks: readonly number[];
  readonly wind: Wind | null;
  tick: number;
  readonly endTick: number;
  ended: boolean;
  /** Per tile: kind (map.ts), hidden power-up in a box, visible power-up, owner (0 grey,
   *  1 + seat), blast ticks left and the blast's seat. */
  kind: Uint8Array;
  hidden: Uint8Array;
  item: Uint8Array;
  owner: Uint8Array;
  blast: Uint8Array;
  blastSeat: Uint8Array;
  players: Player[];
  pushes: Push[];
  nextPushId: number;
  /** The diff, per seat. */
  plus: number[];
  minus: number[];
  /** Ring tiles closed so far by the code freeze. */
  frozen: number;
  stats: Stats;
  /** What happened during the last tick (for the HUD, the commit log and effects). */
  events: GameEvent[];
};

export function deskOf(map: MapDef, seat: number): readonly [number, number] {
  return map.desks[BRANCHES[seat]!];
}

export function newPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    dir: -1,
    progress: 0,
    facing: 2,
    pref: -1,
    prevInput: 0,
    range: RULES.startRange,
    carry: RULES.startCarry,
    coffee: 0,
    duck: 0,
    rebase: 0,
    out: 0,
    grace: 0,
    fellX: x,
    fellY: y,
    revertedBy: -1,
  };
}

export function createMatch(setup: MatchSetup): GameState {
  const { map } = setup;
  const layout = layoutFor(map, seedRng(setup.seed));
  const n = map.width * map.height;
  return {
    version: SIM_VERSION,
    mapId: map.id,
    seed: setup.seed | 0,
    width: map.width,
    height: map.height,
    freeze: setup.freeze ?? false,
    desks: BRANCHES.map((_, seat) => {
      const [x, y] = deskOf(map, seat);
      return y * map.width + x;
    }),
    wind: map.wind,
    tick: 0,
    endTick: setup.ticks,
    ended: false,
    kind: layout.kind,
    hidden: layout.hidden,
    item: new Uint8Array(n),
    owner: new Uint8Array(n),
    blast: new Uint8Array(n),
    blastSeat: new Uint8Array(n),
    players: BRANCHES.map((_, seat) => {
      const [x, y] = deskOf(map, seat);
      const p = newPlayer(x, y);
      if (((setup.closed ?? 0) >> seat) & 1) p.out = CLOSED;
      return p;
    }),
    pushes: [],
    nextPushId: 1,
    plus: new Array<number>(SEATS).fill(0),
    minus: new Array<number>(SEATS).fill(0),
    frozen: 0,
    stats: {
      pushes: new Array<number>(SEATS).fill(0),
      reverted: new Array<number>(SEATS).fill(0),
      boxes: new Array<number>(SEATS).fill(0),
      bestSeat: -1,
      bestGain: 0,
    },
    events: [],
  };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    kind: s.kind.slice(),
    hidden: s.hidden.slice(),
    item: s.item.slice(),
    owner: s.owner.slice(),
    blast: s.blast.slice(),
    blastSeat: s.blastSeat.slice(),
    players: s.players.map((p) => ({ ...p })),
    pushes: s.pushes.map((p) => ({ ...p })),
    plus: s.plus.slice(),
    minus: s.minus.slice(),
    stats: {
      ...s.stats,
      pushes: s.stats.pushes.slice(),
      reverted: s.stats.reverted.slice(),
      boxes: s.stats.boxes.slice(),
    },
    events: s.events.slice(),
  };
}

/** Floor tiles a player can be on: in bounds and not a rack (boxes count; they break). */
export function isFloorTile(s: GameState, i: number): boolean {
  return s.kind[i] === FLOOR;
}

/** The tile a player counts as standing on: the one they are closer to, mid-step. */
export function stepTicks(p: Player): number {
  return p.coffee > 0 ? RULES.coffeeStepTicks : RULES.stepTicks;
}

export function effectiveTile(s: GameState, p: Player): number {
  if (p.dir !== -1 && p.progress * 2 >= stepTicks(p)) {
    const dx = p.dir === 1 ? 1 : p.dir === 3 ? -1 : 0;
    const dy = p.dir === 2 ? 1 : p.dir === 0 ? -1 : 0;
    return (p.y + dy) * s.width + (p.x + dx);
  }
  return p.y * s.width + p.x;
}

export function inPlay(p: Player): boolean {
  return p.out === 0;
}

/** Whether the seat is in this match at all (closed seats aren't). */
export function isOpen(p: Player): boolean {
  return p.out !== CLOSED;
}

/** The closed seats as a bitmask (bit 0 = main), as `MatchSetup.closed` takes them. */
export function closedMask(s: Pick<GameState, "players">): number {
  let m = 0;
  s.players.forEach((p, seat) => {
    if (!isOpen(p)) m |= 1 << seat;
  });
  return m;
}

export function pushAt(s: GameState, i: number): Push | undefined {
  const x = i % s.width;
  const y = (i - x) / s.width;
  return s.pushes.find((q) => q.x === x && q.y === y);
}

/**
 * FNV-1a over every field that matters, in a fixed order. Events are left out (they're derived).
 * Two engines that agree on the hash agree on the state.
 */
export function hashState(s: GameState): number {
  let h = 0x811c9dc5;
  const add = (v: number) => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  add(s.version);
  add(s.seed);
  add(s.tick);
  add(s.endTick);
  add(s.ended ? 1 : 0);
  add(s.frozen);
  for (const arr of [s.kind, s.hidden, s.item, s.owner, s.blast, s.blastSeat])
    for (let i = 0; i < arr.length; i++) add(arr[i]!);
  for (const p of s.players) {
    add(p.x);
    add(p.y);
    add(p.dir);
    add(p.progress);
    add(p.facing);
    add(p.pref);
    add(p.prevInput);
    add(p.range);
    add(p.carry);
    add(p.coffee);
    add(p.duck);
    add(p.rebase);
    add(p.out);
    add(p.grace);
    add(p.fellX);
    add(p.fellY);
    add(p.revertedBy);
  }
  add(s.pushes.length);
  for (const q of s.pushes) {
    add(q.id);
    add(q.owner);
    add(q.x);
    add(q.y);
    add(q.fuse);
    add(q.age);
    add(q.range);
    add(q.rebase);
    add(q.pass);
  }
  add(s.nextPushId);
  for (let i = 0; i < SEATS; i++) {
    add(s.plus[i]!);
    add(s.minus[i]!);
    add(s.stats.pushes[i]!);
    add(s.stats.reverted[i]!);
    add(s.stats.boxes[i]!);
  }
  add(s.stats.bestSeat);
  add(s.stats.bestGain);
  return h >>> 0;
}

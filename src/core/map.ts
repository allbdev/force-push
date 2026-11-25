/**
 * Map definitions (GAME_PLAN.md §8): parsed and validated by hand (no schema library), then
 * turned into a grid for a given seed. Everything that comes in is `unknown` until checked.
 */
import { BRANCHES, type Branch } from "../content/branches";
import { POWER_UPS, powerUpCode, type PowerUp } from "../content/power-ups";
import { pickWeighted, shuffle, type RngState } from "./rng";

export const MIN_SIZE = 5;
export const MAX_SIZE = 31;

export type Dir = 0 | 1 | 2 | 3;
/** Up, right, down, left on screen (y grows downwards). */
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export type Wind = { readonly dir: Dir; readonly delay: number };

export type MapDef = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Rack tiles as indices (y * width + x). */
  readonly racks: readonly number[];
  readonly desks: Readonly<Record<Branch, readonly [number, number]>>;
  readonly boxDensity: number;
  readonly clear: number;
  readonly dropRate: number;
  readonly dropWeights: Readonly<Partial<Record<PowerUp, number>>>;
  readonly wind: Wind | null;
};

export type ParseResult = { ok: true; map: MapDef } | { ok: false; error: string };

const TOP_KEYS = ["id", "size", "racks", "desks", "boxes", "drops", "wind"];
const DIR_NAMES = ["north", "east", "south", "west"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function isRatio(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

function unknownKeys(obj: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) return key;
  return null;
}

function point(v: unknown, w: number, h: number): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [x, y] = v as unknown[];
  return isInt(x, 0, w - 1) && isInt(y, 0, h - 1) ? [x, y] : null;
}

/** Validates a map from JSON. Rejects unknown keys, desks in racks and unreachable desks. */
export function parseMap(input: unknown): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });
  if (!isRecord(input)) return fail("map: not an object");
  const extra = unknownKeys(input, TOP_KEYS);
  if (extra) return fail(`map: unknown key "${extra}"`);

  const { id, size, racks, desks, boxes, drops, wind } = input;
  if (typeof id !== "string" || !/^[a-z0-9-]{1,32}$/.test(id)) return fail("id: bad");
  if (!Array.isArray(size) || size.length !== 2) return fail("size: expected [w, h]");
  const [w, h] = size as unknown[];
  if (!isInt(w, MIN_SIZE, MAX_SIZE) || !isInt(h, MIN_SIZE, MAX_SIZE)) return fail("size: range");

  const rackSet = new Set<number>();
  if (racks === "grid") {
    for (let y = 1; y < h; y += 2) for (let x = 1; x < w; x += 2) rackSet.add(y * w + x);
  } else if (Array.isArray(racks)) {
    for (const r of racks) {
      const p = point(r, w, h);
      if (!p) return fail("racks: bad point");
      rackSet.add(p[1] * w + p[0]);
    }
  } else return fail('racks: expected "grid" or a list');

  if (!isRecord(desks)) return fail("desks: not an object");
  const extraDesk = unknownKeys(desks, BRANCHES);
  if (extraDesk) return fail(`desks: unknown key "${extraDesk}"`);
  const deskPoints = {} as Record<Branch, [number, number]>;
  const used = new Set<number>();
  for (const b of BRANCHES) {
    const p = point(desks[b], w, h);
    if (!p) return fail(`desks.${b}: bad point`);
    const i = p[1] * w + p[0];
    if (rackSet.has(i)) return fail(`desks.${b}: inside a rack`);
    if (used.has(i)) return fail(`desks.${b}: shared with another desk`);
    used.add(i);
    deskPoints[b] = p;
  }

  if (!isRecord(boxes)) return fail("boxes: not an object");
  const extraBox = unknownKeys(boxes, ["density", "clear"]);
  if (extraBox) return fail(`boxes: unknown key "${extraBox}"`);
  if (!isRatio(boxes.density)) return fail("boxes.density: expected 0..1");
  if (!isInt(boxes.clear, 0, 6)) return fail("boxes.clear: expected 0..6");

  if (!isRecord(drops)) return fail("drops: not an object");
  const extraDrop = unknownKeys(drops, ["rate", "weights"]);
  if (extraDrop) return fail(`drops: unknown key "${extraDrop}"`);
  if (!isRatio(drops.rate)) return fail("drops.rate: expected 0..1");
  if (!isRecord(drops.weights)) return fail("drops.weights: not an object");
  const weights: Partial<Record<PowerUp, number>> = {};
  for (const [k, v] of Object.entries(drops.weights)) {
    if (!(POWER_UPS as readonly string[]).includes(k)) return fail(`drops.weights: unknown "${k}"`);
    if (!isInt(v, 0, 100)) return fail(`drops.weights.${k}: expected 0..100`);
    weights[k as PowerUp] = v;
  }
  if (drops.rate > 0 && !Object.values(weights).some((v) => v > 0))
    return fail("drops.weights: all zero");

  let windDef: Wind | null = null;
  if (wind !== null) {
    if (!isRecord(wind)) return fail("wind: expected null or an object");
    const extraWind = unknownKeys(wind, ["dir", "delay"]);
    if (extraWind) return fail(`wind: unknown key "${extraWind}"`);
    const dir = DIR_NAMES.indexOf(String(wind.dir));
    if (dir < 0) return fail("wind.dir: expected north/east/south/west");
    if (!isInt(wind.delay, 1, 200)) return fail("wind.delay: expected 1..200 ticks");
    windDef = { dir: dir as Dir, delay: wind.delay };
  }

  // Every desk must reach every other desk over floor (boxes break, racks don't).
  const start = deskPoints.main[1] * w + deskPoints.main[0];
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.shift()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      const j = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || rackSet.has(j) || seen.has(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  for (const b of BRANCHES)
    if (!seen.has(deskPoints[b][1] * w + deskPoints[b][0])) return fail(`desks.${b}: unreachable`);

  return {
    ok: true,
    map: {
      id,
      width: w,
      height: h,
      racks: [...rackSet].sort((a, b) => a - b),
      desks: deskPoints,
      boxDensity: boxes.density,
      clear: boxes.clear,
      dropRate: drops.rate,
      dropWeights: weights,
      wind: windDef,
    },
  };
}

/** Tile kinds in the grid. */
export const FLOOR = 0;
export const RACK = 1;
export const BOX = 2;
export const FROZEN = 3;

export type Layout = {
  /** Tile kind per index. */
  readonly kind: Uint8Array;
  /** The power-up a box hides (powerUpCode), 0 for none. */
  readonly hidden: Uint8Array;
};

/** Racks, then seeded boxes (none near a desk), then seeded hidden power-ups. */
export function layoutFor(map: MapDef, rng: RngState): Layout {
  const n = map.width * map.height;
  const kind = new Uint8Array(n);
  const hidden = new Uint8Array(n);
  for (const r of map.racks) kind[r] = RACK;

  const free: number[] = [];
  for (let i = 0; i < n; i++) {
    if (kind[i] !== FLOOR) continue;
    const x = i % map.width;
    const y = (i - x) / map.width;
    const nearDesk = BRANCHES.some((b) => {
      const [dx, dy] = map.desks[b];
      return Math.abs(dx - x) + Math.abs(dy - y) <= map.clear;
    });
    if (!nearDesk) free.push(i);
  }
  shuffle(rng, free);
  const boxCount = Math.round(free.length * map.boxDensity);
  const boxes = free.slice(0, boxCount).sort((a, b) => a - b);
  for (const b of boxes) kind[b] = BOX;

  const weights = map.dropWeights as Record<string, number>;
  const dropCount = Math.round(boxes.length * map.dropRate);
  shuffle(rng, boxes);
  for (let k = 0; k < dropCount; k++) {
    hidden[boxes[k]!] = powerUpCode(pickWeighted(rng, weights) as PowerUp);
  }
  return { kind, hidden };
}

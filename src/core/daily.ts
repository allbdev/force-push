/**
 * The daily map (GAME_PLAN.md §8): drawn from the date, the same for everyone. Built from the same
 * pieces as the hand-made maps, validated, then played by bots for 40 seconds; if a bot gets stuck
 * or a desk is walled in, the generator re-rolls.
 */
import { BRANCHES } from "../content/branches";
import { POWER_UPS } from "../content/power-ups";
import { botInput } from "./bot";
import { BOX, parseMap, type MapDef } from "./map";
import { hash32, nextInt, seedRng, type RngState } from "./rng";
import { createMatch, effectiveTile, inPlay } from "./state";
import { stepInPlace } from "./step";

const W = 13;
const H = 11;

/** `daily-20261122` for a date given as year, month (1–12) and day. */
export function dailyId(year: number, month: number, day: number): string {
  return `daily-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

export function parseDailyId(id: string): { year: number; month: number; day: number } | null {
  const m = /^daily-(\d{4})(\d{2})(\d{2})$/.exec(id);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 2026 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

type Layout = "grid" | "rows" | "plaza" | "scatter";
const LAYOUTS: readonly Layout[] = ["grid", "rows", "plaza", "scatter"];

function racksFor(layout: Layout, rng: RngState): number[][] {
  const grid: number[][] = [];
  for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) grid.push([x, y]);
  switch (layout) {
    case "grid":
      return grid;
    case "rows": {
      const gap = 2 + nextInt(rng, 3) * 2; // an aisle at x = 2, 4 or 6 (mirrored)
      const out: number[][] = [];
      for (let y = 1; y < H; y += 2)
        for (let x = 1; x < W - 1; x++) if (x !== gap && x !== W - 1 - gap) out.push([x, y]);
      return out;
    }
    case "plaza":
      return grid.filter(([x, y]) => Math.abs(x! - 6) + Math.abs(y! - 5) > 2);
    case "scatter": {
      // The grid, plus a few extra racks placed with four-way symmetry.
      const extra: number[][] = [];
      for (let k = 0; k < 3; k++) {
        const x = 2 + nextInt(rng, 2) * 2;
        const y = 1 + nextInt(rng, 4) * 2;
        extra.push([x, y], [W - 1 - x, y], [x, H - 1 - y], [W - 1 - x, H - 1 - y]);
      }
      const keys = new Set(grid.map((p) => p.join(",")));
      for (const p of extra) keys.add(p.join(","));
      return [...keys].map((k) => k.split(",").map(Number));
    }
  }
}

function candidate(id: string, salt: number): unknown {
  const date = parseDailyId(id)!;
  const rng = seedRng(hash32(date.year, date.month, date.day, salt));
  const layout = LAYOUTS[nextInt(rng, LAYOUTS.length)]!;
  const windy = nextInt(rng, 4) === 0;
  const weights: Record<string, number> = {};
  for (const p of POWER_UPS) weights[p] = 1 + nextInt(rng, 4);
  return {
    id,
    size: [W, H],
    racks: racksFor(layout, rng),
    desks: { main: [0, 0], feature: [W - 1, 0], hotfix: [0, H - 1], dev: [W - 1, H - 1] },
    boxes: { density: (45 + nextInt(rng, 21)) / 100, clear: 2 },
    drops: { rate: 0.3, weights },
    wind: windy ? { dir: ["north", "east", "south", "west"][nextInt(rng, 4)], delay: 20 } : null,
  };
}

/** Bots play 40 seconds on it; false if one stands still for 10 s while boxes remain. */
export function botsCanPlay(map: MapDef, seed: number): boolean {
  const s = createMatch({ map, seed, ticks: 800 });
  const still = [0, 0, 0, 0];
  const last = s.players.map((p) => effectiveTile(s, p));
  const inputs = [0, 0, 0, 0];
  while (!s.ended) {
    for (let seat = 0; seat < BRANCHES.length; seat++) inputs[seat] = botInput(s, seat);
    stepInPlace(s, inputs);
    const boxes = s.kind.includes(BOX);
    for (let seat = 0; seat < BRANCHES.length; seat++) {
      const p = s.players[seat]!;
      const t = effectiveTile(s, p);
      if (!inPlay(p) || t !== last[seat]) {
        still[seat] = 0;
        last[seat] = t;
      } else if (boxes && ++still[seat]! > 200) return false;
    }
  }
  return s.stats.pushes.every((n) => n > 0);
}

const cache = new Map<string, MapDef>();

/** The map of the day for a `daily-YYYYMMDD` id, or undefined for anything else. */
export function dailyMap(id: string): MapDef | undefined {
  if (!parseDailyId(id)) return undefined;
  const hit = cache.get(id);
  if (hit) return hit;
  for (let salt = 0; salt < 20; salt++) {
    const parsed = parseMap(candidate(id, salt));
    if (parsed.ok && botsCanPlay(parsed.map, hash32(salt, 7))) {
      cache.set(id, parsed.map);
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
      return parsed.map;
    }
  }
  return undefined;
}

import { BOX, FLOOR, parseMap, RACK, type MapDef } from "../../src/core/map";
import { createMatch, type GameState } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { mapById } from "../../src/content/maps";

/**
 * Builds a state from a picture. `.` floor, `#` rack, `b` box, `0`–`3` a seat's desk (where it
 * stands). Boxes hide nothing unless `hidden` says so. Wind and freeze are opt-in.
 */
export function fromAscii(
  rows: readonly string[],
  opts: { ticks?: number; freeze?: boolean; wind?: { dir: string; delay: number } } = {},
): GameState {
  const h = rows.length;
  const w = rows[0]!.length;
  const racks: [number, number][] = [];
  const desks: Record<string, [number, number]> = {};
  const names = ["main", "feature", "hotfix", "dev"];
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "#") racks.push([x, y]);
      if (/[0-3]/.test(c)) desks[names[Number(c)]!] = [x, y];
    }),
  );
  const result = parseMap({
    id: "test",
    size: [w, h],
    racks,
    desks,
    boxes: { density: 0, clear: 0 },
    drops: { rate: 0, weights: {} },
    wind: opts.wind ?? null,
  });
  if (!result.ok) throw new Error(result.error);
  const s = createMatch({
    map: result.map,
    seed: 1,
    ticks: opts.ticks ?? 100_000,
    freeze: opts.freeze,
  });
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const i = y * w + x;
      s.kind[i] = c === "#" ? RACK : c === "b" ? BOX : FLOOR;
    }),
  );
  return s;
}

export function openSpace(): MapDef {
  return mapById("open-space")!;
}

/** Runs `n` ticks with the same inputs. */
export function run(s: GameState, n: number, inputs: readonly number[] = [0, 0, 0, 0]): GameState {
  for (let k = 0; k < n; k++) stepInPlace(s, inputs);
  return s;
}

export const tile = (s: GameState, x: number, y: number) => y * s.width + x;

/** Inputs for one seat, the others idle. */
export function only(seat: number, bits: number): number[] {
  const out = [0, 0, 0, 0];
  out[seat] = bits;
  return out;
}

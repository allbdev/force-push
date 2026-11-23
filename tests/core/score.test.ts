import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { scoreMatch, shares } from "../../src/core/score";
import { CLOSED } from "../../src/core/state";
import { fromAscii, tile } from "./helpers";

const ROOM = [".....", ".#.#.", "0.1.2", ".#.#.", "3...."];

describe("shares", () => {
  it("are whole percents of the painted tiles that add up to 100", () => {
    expect(shares([31, 27, 23, 19])).toEqual([31, 27, 23, 19]);
    expect(shares([1, 1, 1, 0])).toEqual([34, 33, 33, 0]);
    expect(shares([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    fc.assert(
      fc.property(fc.array(fc.nat(500), { minLength: 4, maxLength: 4 }), (counts) => {
        const pct = shares(counts);
        const total = counts.reduce((a, b) => a + b, 0);
        expect(pct.reduce((a, b) => a + b, 0)).toBe(total === 0 ? 0 : 100);
        pct.forEach((p, i) => {
          if (total) expect(Math.abs(p - (counts[i]! * 100) / total)).toBeLessThan(1);
        });
      }),
    );
  });
});

describe("scoreMatch", () => {
  function paintCounts(counts: number[], plus: number[]) {
    const s = fromAscii(ROOM);
    let i = 0;
    counts.forEach((n, seat) => {
      for (let k = 0; k < n; k++) {
        while (s.kind[i] !== 0) i++;
        s.owner[i++] = seat + 1;
      }
    });
    s.plus = plus;
    s.minus = plus.map((p, seat) => p - counts[seat]!);
    return s;
  }

  it("ranks by tiles owned and names the winner", () => {
    const r = scoreMatch(paintCounts([5, 3, 2, 1], [9, 9, 9, 9]));
    expect(r.rows.map((x) => x.seat)).toEqual([0, 1, 2, 3]);
    expect(r.winners).toEqual([0]);
    expect(r.painted).toBe(11);
    r.rows.forEach((row) => expect(row.plus - row.minus).toBe(row.owned));
  });

  it("breaks a tie on tiles with the bigger +", () => {
    const r = scoreMatch(paintCounts([4, 4, 0, 0], [6, 9, 0, 0]));
    expect(r.winners).toEqual([1]);
  });

  it("never shows the loser of a tie on tiles with the bigger share", () => {
    // 5, 5 and 1 tiles: 45.45%, 45.45% and 9.09%, one spare point between the tied two.
    const r = scoreMatch(paintCounts([5, 5, 0, 1], [6, 9, 0, 2]));
    expect(r.winners).toEqual([1]);
    const pct = Object.fromEntries(r.rows.map((x) => [x.seat, x.share]));
    expect(pct[1]).toBeGreaterThanOrEqual(pct[0]!);
    expect(pct[0]! + pct[1]! + pct[3]!).toBe(100);
  });

  it("shares the win on a full tie", () => {
    const r = scoreMatch(paintCounts([4, 4, 0, 0], [6, 6, 0, 0]));
    expect(r.winners).toEqual([0, 1]);
  });

  it("leaves closed seats out of the rows and splits 100% between the open ones", () => {
    const s = paintCounts([5, 0, 6, 0], [5, 0, 7, 0]);
    s.players[1]!.out = CLOSED;
    s.players[3]!.out = CLOSED;
    const r = scoreMatch(s);
    expect(r.rows.map((x) => x.seat)).toEqual([2, 0]);
    expect(r.rows.reduce((a, x) => a + x.share, 0)).toBe(100);
    expect(r.winners).toEqual([2]);
  });

  it("reports the highlights", () => {
    const s = fromAscii(ROOM);
    s.stats.reverted = [0, 4, 1, 0];
    s.stats.bestSeat = 3;
    s.stats.bestGain = 14;
    s.stats.boxes = [5, 6, 7, 5];
    const r = scoreMatch(s);
    expect([r.mostRevertedSeat, r.mostReverted]).toEqual([1, 4]);
    expect([r.bestSeat, r.bestGain, r.boxes]).toEqual([3, 14, 23]);
    expect(tile(s, 0, 0)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { hash32, nextInt, nextU32, pickWeighted, seedRng, shuffle } from "../../src/core/rng";

describe("rng", () => {
  it("repeats exactly for the same seed", () => {
    const a = seedRng(1758);
    const b = seedRng(1758);
    for (let i = 0; i < 1000; i++) expect(nextU32(a)).toBe(nextU32(b));
  });

  it("differs for different seeds", () => {
    const a = seedRng(1);
    const b = seedRng(2);
    const same = Array.from({ length: 100 }, () => nextU32(a) === nextU32(b)).filter(Boolean);
    expect(same.length).toBeLessThan(3);
  });

  it("gives a known sequence (guards cross-engine drift)", () => {
    const s = seedRng(42);
    expect([nextU32(s), nextU32(s), nextU32(s)]).toMatchSnapshot();
    expect(hash32(1, 2, 3)).toMatchSnapshot();
  });

  it("stays in range and is roughly uniform", () => {
    const s = seedRng(7);
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[nextInt(s, 6)]!++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  });

  it("nextInt is always an integer in [0, n)", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 2 ** 31 }), (seed, n) => {
        const x = nextInt(seedRng(seed), n);
        expect(Number.isInteger(x) && x >= 0 && x < n).toBe(true);
      }),
    );
  });

  it("shuffle is a permutation", () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.integer(), { maxLength: 50 }), (seed, xs) => {
        const out = shuffle(seedRng(seed), [...xs]);
        expect([...out].sort()).toEqual([...xs].sort());
      }),
    );
  });

  it("pickWeighted follows the weights and ignores key order", () => {
    const s = seedRng(3);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 40_000; i++) counts[pickWeighted(s, { a: 1, b: 3, c: 0 })]!++;
    expect(counts.c).toBe(0);
    expect(counts.b! / counts.a!).toBeGreaterThan(2.7);
    expect(counts.b! / counts.a!).toBeLessThan(3.3);
    expect(pickWeighted(seedRng(9), { x: 1, y: 1 })).toBe(pickWeighted(seedRng(9), { y: 1, x: 1 }));
  });
});

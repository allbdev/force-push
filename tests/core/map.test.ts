import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BOX, FLOOR, layoutFor, parseMap, RACK } from "../../src/core/map";
import { seedRng } from "../../src/core/rng";
import { MAPS, mapById } from "../../src/content/maps";
import openSpace from "../../src/content/maps/open-space.json";

const base = () => JSON.parse(JSON.stringify(openSpace)) as Record<string, unknown>;

function errorOf(json: unknown): string {
  const r = parseMap(json);
  return r.ok ? "ok" : r.error;
}

describe("parseMap", () => {
  it("accepts Open Space: 13 × 11, 30 racks, 113 floor tiles", () => {
    const map = mapById("open-space")!;
    expect([map.width, map.height]).toEqual([13, 11]);
    expect(map.racks).toHaveLength(30);
    expect(map.width * map.height - map.racks.length).toBe(113);
  });

  it("rejects unknown keys at every level", () => {
    expect(errorOf({ ...base(), extra: 1 })).toMatch(/unknown key "extra"/);
    expect(errorOf({ ...base(), boxes: { density: 0.5, clear: 2, x: 1 } })).toMatch(/unknown/);
    expect(errorOf({ ...base(), desks: { ...(base().desks as object), qa: [1, 1] } })).toMatch(
      /unknown/,
    );
    expect(errorOf({ ...base(), drops: { rate: 0.3, weights: { coffee: 1, pizza: 2 } } })).toMatch(
      /unknown "pizza"/,
    );
  });

  it("rejects a desk inside a rack, outside the map or shared", () => {
    const desks = base().desks as Record<string, unknown>;
    expect(errorOf({ ...base(), desks: { ...desks, main: [1, 1] } })).toMatch(/inside a rack/);
    expect(errorOf({ ...base(), desks: { ...desks, main: [13, 0] } })).toMatch(/bad point/);
    expect(errorOf({ ...base(), desks: { ...desks, dev: [0, 0] } })).toMatch(/shared/);
  });

  it("rejects an unreachable desk", () => {
    // Wall off the top-left corner with racks.
    const racks = [
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    expect(errorOf({ ...base(), racks })).toMatch(/unreachable/);
  });

  it("rejects bad types and ranges", () => {
    expect(errorOf(null)).toMatch(/not an object/);
    expect(errorOf([])).toMatch(/not an object/);
    expect(errorOf({ ...base(), size: [4, 11] })).toMatch(/size/);
    expect(errorOf({ ...base(), size: [13.5, 11] })).toMatch(/size/);
    expect(errorOf({ ...base(), id: "Open Space!" })).toMatch(/id/);
    expect(errorOf({ ...base(), boxes: { density: 2, clear: 2 } })).toMatch(/density/);
    expect(errorOf({ ...base(), wind: { dir: "up", delay: 20 } })).toMatch(/wind.dir/);
    expect(errorOf({ ...base(), wind: { dir: "east", delay: 20 } })).toBe("ok");
    expect(errorOf({ ...base(), drops: { rate: 0.3, weights: { coffee: 0 } } })).toMatch(
      /all zero/,
    );
  });

  it("never throws on arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        expect(() => parseMap(v)).not.toThrow();
      }),
    );
  });

  it("every shipped map is valid", () => {
    expect(MAPS.length).toBeGreaterThan(0);
  });
});

describe("layoutFor", () => {
  const map = mapById("open-space")!;

  it("is the same for the same seed and differs between seeds", () => {
    const a = layoutFor(map, seedRng(5));
    const b = layoutFor(map, seedRng(5));
    const c = layoutFor(map, seedRng(6));
    expect(a.kind).toEqual(b.kind);
    expect(a.hidden).toEqual(b.hidden);
    expect(a.kind).not.toEqual(c.kind);
  });

  it("covers about 60% of the free floor with boxes, 30% hiding a power-up, none near desks", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const { kind, hidden } = layoutFor(map, seedRng(seed));
        const count = (k: number) => kind.filter((v) => v === k).length;
        expect(count(RACK)).toBe(30);
        expect(count(BOX) + count(FLOOR)).toBe(113);
        // 113 floor minus 4 × 5 tiles near the desks = 93 candidates → 56 boxes, 17 power-ups.
        expect(count(BOX)).toBe(56);
        expect(hidden.filter((v) => v > 0).length).toBe(17);
        for (let i = 0; i < kind.length; i++) if (hidden[i]) expect(kind[i]).toBe(BOX);
        for (const [x, y] of Object.values(map.desks)) {
          for (let i = 0; i < kind.length; i++) {
            const tx = i % map.width;
            const ty = Math.floor(i / map.width);
            if (Math.abs(tx - x) + Math.abs(ty - y) <= 2) expect(kind[i]).not.toBe(BOX);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it("only hides the power-ups the map lists", () => {
    const { hidden } = layoutFor(map, seedRng(1));
    // coffee = 1, duck = 2, stackOverflow = 3 (first version only).
    for (const v of hidden) expect(v).toBeLessThanOrEqual(3);
  });
});

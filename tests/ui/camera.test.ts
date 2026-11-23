import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { followFraming, isPortrait, overviewFraming } from "../../src/ui/camera";
import { blend, playerPoint, walkPhase } from "../../src/ui/positions";
import { newPlayer } from "../../src/core/state";

describe("camera framing", () => {
  it("looks at the middle of the map from above and in front", () => {
    const f = overviewFraming(13, 11, 16 / 9);
    expect(f.at[0]).toBeCloseTo(6);
    expect(f.from[1]).toBeGreaterThan(5);
    expect(f.from[2]).toBeGreaterThan(f.at[2]);
  });

  it("backs off on narrow screens so the whole map still fits", () => {
    const wide = overviewFraming(13, 11, 16 / 9);
    const square = overviewFraming(13, 11, 1);
    expect(square.from[1]).toBeGreaterThan(wide.from[1]);
  });

  it("follows the player on portrait phones, clamped inside the map", () => {
    expect(isPortrait(390, 844)).toBe(true);
    expect(isPortrait(1280, 720)).toBe(false);
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 12, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (x, z) => {
          const f = followFraming(x, z, 13, 11, 390 / 844);
          expect(f.at[0]).toBeGreaterThanOrEqual(0);
          expect(f.at[0]).toBeLessThanOrEqual(12);
          expect(Number.isFinite(f.from[1])).toBe(true);
        },
      ),
    );
  });
});

describe("positions", () => {
  it("turns step progress into a fraction of a tile", () => {
    const p = newPlayer(3, 4);
    expect(playerPoint(p)).toEqual({ x: 3, y: 4 });
    p.dir = 1;
    p.progress = 2;
    expect(playerPoint(p).x).toBeCloseTo(3.4);
  });

  it("blends between ticks but snaps on a respawn", () => {
    expect(blend({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.5)).toEqual({ x: 0.5, y: 0 });
    expect(blend({ x: 0, y: 0 }, { x: 9, y: 9 }, 0.1)).toEqual({ x: 9, y: 9 });
  });

  it("walk phase stays in [0, 1) and is 0 when standing", () => {
    expect(walkPhase({ x: 3.3, y: 1 }, false)).toBe(0);
    const w = walkPhase({ x: 3.3, y: 1 }, true);
    expect(w).toBeGreaterThanOrEqual(0);
    expect(w).toBeLessThan(1);
  });
});

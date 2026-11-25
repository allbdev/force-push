import { describe, expect, it } from "vitest";
import { deltaE2000, floorPairs, hexToRgb, linearToLab, simulate } from "../../tools/colour-check";

describe("CIEDE2000", () => {
  it("matches Sharma, Wu & Dalal (2005) reference pairs", () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 3);
    expect(deltaE2000([2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514])).toBeCloseTo(0.9082, 3);
  });

  it("is zero for the same colour and symmetric", () => {
    const a = linearToLab(simulate(hexToRgb("#3f8cff"), null));
    const b = linearToLab(simulate(hexToRgb("#ff4f93"), null));
    expect(deltaE2000(a, a)).toBe(0);
    expect(deltaE2000(a, b)).toBeCloseTo(deltaE2000(b, a), 9);
  });

  it("maps white to L* 100", () => {
    expect(linearToLab(simulate(hexToRgb("#ffffff"), null))[0]).toBeCloseTo(100, 1);
  });
});

describe("floor colours (roadmap task 9)", () => {
  const pairs = floorPairs();

  it("are far apart for normal vision", () => {
    for (const p of pairs.filter((q) => q.vision === "normal"))
      expect(p.deltaE, `${p.a}/${p.b}`).toBeGreaterThan(15);
  });

  it("collide only where expected under colour-blindness, which is why tiles carry patterns", () => {
    // ΔE00 under 10 is hard to tell apart at a glance. Recorded 22 Nov 2026; if this list changes,
    // re-check the floor patterns (GAME_PLAN.md §10).
    const close = pairs.filter((p) => p.deltaE < 10).map((p) => `${p.vision}:${p.a}/${p.b}`);
    expect(close.sort()).toEqual([
      "deuteranopia:dev/grey",
      "deuteranopia:hotfix/dev",
      "protanopia:hotfix/grey",
    ]);
  });
});

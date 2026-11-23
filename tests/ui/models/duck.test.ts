import { describe, expect, it } from "vitest";
import { countTriangles } from "../../../src/ui/models/bevel";
import { DUCK_HEIGHT, DUCK_LENGTH, buildDuck } from "../../../src/ui/models/duck";
import { boundsOf, expectShared, geometriesOf, isFinite3d } from "./helpers";

const DUCK_TRIANGLE_BUDGET = 500;

describe("buildDuck", () => {
  it("is a small duck sitting on the floor, beak forward (+z)", () => {
    const duck = buildDuck();
    const box = boundsOf(duck);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(box.max.y).toBeLessThanOrEqual(DUCK_HEIGHT);
    expect(box.max.z - box.min.z).toBeLessThanOrEqual(DUCK_LENGTH + 0.05);
    expect(boundsOf(duck.getObjectByName("beak")!).max.z).toBeCloseTo(box.max.z, 6);
    expect(isFinite3d(duck)).toBe(true);
    expect(countTriangles(duck)).toBeLessThan(DUCK_TRIANGLE_BUDGET);
  });

  it("scales, and shares its geometry at every scale", () => {
    const small = buildDuck(0.5);
    const big = buildDuck(2);
    expect(boundsOf(big).max.y).toBeCloseTo(boundsOf(small).max.y * 4, 5);
    expect(geometriesOf(big)).toEqual(geometriesOf(small));
    expectShared(buildDuck(), buildDuck());
  });
});

import { Group, Mesh, SphereGeometry, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCHES, BRANCH_COLOURS } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  FUSE_LEVELS,
  ORB_RADIUS,
  buildForcePush,
  fusePulse,
  setFuse,
} from "../../../src/ui/models/force-push";
import { boundsOf, expectFitsTile, expectShared, isFinite3d, meshesOf } from "./helpers";

const FORCE_PUSH_TRIANGLE_BUDGET = 1400;

function fuseOf(push: Group): Mesh {
  return push.getObjectByName("fuse") as Mesh;
}

describe("buildForcePush", () => {
  it.each(BRANCHES)("builds the %s orb on its tile, under the triangle budget", (branch) => {
    const push = buildForcePush(branch);
    expect(push.name).toBe(`force-push-${branch}`);
    expect(push.userData.branch).toBe(branch);
    expectFitsTile(push, 0.85, 0.6);
    expect(isFinite3d(push)).toBe(true);
    expect(countTriangles(push)).toBeLessThan(FORCE_PUSH_TRIANGLE_BUDGET);
  });

  it("is a dark sphere: the one round thing among the boxes", () => {
    const orb = buildForcePush("main").getObjectByName("orb") as Mesh;
    expect(orb.geometry).toBeInstanceOf(SphereGeometry);
    expect(boundsOf(orb).max.x).toBeCloseTo(ORB_RADIUS, 5);
    const colour = (orb.material as MeshStandardMaterial).color;
    expect(Math.max(colour.r, colour.g, colour.b)).toBeLessThan(0.1);
  });

  it.each(BRANCHES)("crosses the %s orb with two bands in the branch colour", (branch) => {
    const bands = meshesOf(buildForcePush(branch)).filter((mesh) => mesh.name === "band");
    expect(bands).toHaveLength(2);
    for (const band of bands) {
      expect((band.material as MeshStandardMaterial).color.getHexString()).toBe(
        BRANCH_COLOURS[branch].slice(1),
      );
    }
    expect(bands[0]!.rotation.equals(bands[1]!.rotation)).toBe(false);
  });

  it("has the fuse light on top, above the orb", () => {
    const push = buildForcePush("dev");
    const top = boundsOf(push.getObjectByName("orb")!).max.y;
    expect(boundsOf(fuseOf(push)).min.y).toBeGreaterThan(top);
    expect(push.getObjectByName("stalk")).toBeDefined();
    expect(push.getObjectByName("ball")).toBeInstanceOf(Group);
  });

  it("shares geometry and materials between two pushes of a branch", () => {
    for (const branch of BRANCHES) expectShared(buildForcePush(branch), buildForcePush(branch));
  });
});

describe("setFuse", () => {
  it("is dark when just dropped and blinks faster as the fuse burns", () => {
    expect(fusePulse(1)).toBeCloseTo(0, 9);
    const peaks = (from: number, to: number): number => {
      let count = 0;
      const steps = 400;
      for (let i = 1; i < steps - 1; i++) {
        const at = (k: number): number => fusePulse(from + ((to - from) * k) / steps);
        if (at(i) > at(i - 1) && at(i) >= at(i + 1)) count++;
      }
      return count;
    };
    expect(peaks(0.5, 0)).toBeGreaterThan(peaks(1, 0.5));
    for (let i = 0; i <= 100; i++) {
      expect(fusePulse(i / 100)).toBeGreaterThanOrEqual(0);
      expect(fusePulse(i / 100)).toBeLessThanOrEqual(1);
    }
  });

  it("swells and brightens the fuse light with the pulse, from shared materials", () => {
    const push = buildForcePush("main");
    const fuse = fuseOf(push);
    setFuse(push, 1);
    const restScale = fuse.scale.x;
    const restGlow = (fuse.material as MeshStandardMaterial).emissiveIntensity;

    // Find a moment near a peak of the pulse.
    let peak = 1;
    for (let i = 0; i <= 1000; i++) if (fusePulse(i / 1000) > fusePulse(peak)) peak = i / 1000;
    setFuse(push, peak);
    expect(fuse.scale.x).toBeGreaterThan(restScale * 1.2);
    expect((fuse.material as MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(restGlow);
    expect(push.getObjectByName("ball")!.scale.x).toBeGreaterThan(1);

    const other = buildForcePush("main");
    setFuse(other, peak);
    expect(fuseOf(other).material).toBe(fuse.material);
    setFuse(other, 1);
    expect(fuseOf(other).material).not.toBe(fuse.material);
  });

  it("uses a fixed set of glow levels and stays on the tile at every moment", () => {
    const push = buildForcePush("hotfix");
    const seen = new Set<unknown>();
    for (let i = 0; i <= 200; i++) {
      setFuse(push, 1 - i / 200);
      seen.add(fuseOf(push).material);
      expect(isFinite3d(push)).toBe(true);
    }
    expect(seen.size).toBe(FUSE_LEVELS);
    setFuse(push, 0.031);
    expectFitsTile(push, 0.9, 0.6);
  });

  it("is a pure function of the fuse left, and clamps it", () => {
    const push = buildForcePush("feature");
    const state = (): number[] => [
      fuseOf(push).scale.x,
      push.getObjectByName("ball")!.scale.x,
      (fuseOf(push).material as MeshStandardMaterial).emissiveIntensity,
    ];
    setFuse(push, 0.37);
    const first = state();
    setFuse(push, 0.9);
    setFuse(push, 0.37);
    expect(state()).toEqual(first);
    setFuse(push, 5);
    const full = state();
    setFuse(push, 1);
    expect(state()).toEqual(full);
    setFuse(push, -2);
    const empty = state();
    setFuse(push, 0);
    expect(state()).toEqual(empty);
  });

  it("does nothing to an object without a fuse", () => {
    expect(() => setFuse(new Group(), 0.5)).not.toThrow();
  });
});

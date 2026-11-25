import { Mesh, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCHES, BRANCH_COLOURS } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import { DESK_HEIGHT, buildDesk } from "../../../src/ui/models/desk";
import { boundsOf, expectFitsTile, expectShared, isFinite3d, materialsOf } from "./helpers";

const DESK_TRIANGLE_BUDGET = 600;

describe("buildDesk", () => {
  it.each(BRANCHES)("builds the %s desk on its tile, monitor included", (branch) => {
    const desk = buildDesk(branch);
    expect(desk.name).toBe(`desk-${branch}`);
    expectFitsTile(desk, 0.85, DESK_HEIGHT + 0.2);
    expect(isFinite3d(desk)).toBe(true);
    expect(countTriangles(desk)).toBeLessThan(DESK_TRIANGLE_BUDGET);
  });

  it("has a top at desk height and a monitor standing on it", () => {
    const desk = buildDesk("main");
    expect(boundsOf(desk.getObjectByName("top")!).max.y).toBeCloseTo(DESK_HEIGHT, 5);
    expect(boundsOf(desk.getObjectByName("monitor")!).min.y).toBeCloseTo(DESK_HEIGHT, 5);
  });

  it.each(BRANCHES)("lights the %s screen and marks the desk in the branch colour", (branch) => {
    const desk = buildDesk(branch);
    const hex = BRANCH_COLOURS[branch].slice(1);
    const screen = (desk.getObjectByName("screen") as Mesh).material as MeshStandardMaterial;
    expect(screen.emissive.getHexString()).toBe(hex);
    expect(screen.emissiveIntensity).toBeGreaterThan(0);
    for (const name of ["accent", "mug"]) {
      const marked = (desk.getObjectByName(name) as Mesh).material as MeshStandardMaterial;
      expect(marked.color.getHexString()).toBe(hex);
    }
  });

  it("shares geometry and materials between desks of a branch, and the frame between branches", () => {
    expectShared(buildDesk("dev"), buildDesk("dev"));
    const shared = [...materialsOf(buildDesk("main"))].filter((m) =>
      materialsOf(buildDesk("dev")).has(m),
    );
    expect(shared.length).toBeGreaterThanOrEqual(2);
  });
});

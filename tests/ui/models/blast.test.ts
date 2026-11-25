import { Color, InstancedMesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { BRANCHES, BRANCH_COLOURS } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  BLAST_HEIGHT,
  blastGeometry,
  blastMaterial,
  buildBlastTile,
} from "../../../src/ui/models/blast";
import { boundsOf, expectFitsTile, isFinite3d } from "./helpers";

const BLAST_TRIANGLE_BUDGET = 100;

describe("the blast tile", () => {
  it.each(BRANCHES)("builds a %s slab that fills its tile exactly", (branch) => {
    const tile = buildBlastTile(branch);
    expect(tile.name).toBe(`blast-${branch}`);
    expectFitsTile(tile, BLAST_HEIGHT + 1e-6, 0.2);
    // A full tile wide, so the arms of the cross join without a gap.
    const size = boundsOf(tile).getSize(new Vector3());
    expect(size.x).toBeCloseTo(1, 6);
    expect(size.z).toBeCloseTo(1, 6);
    expect(isFinite3d(tile)).toBe(true);
    expect(countTriangles(tile)).toBeLessThan(BLAST_TRIANGLE_BUDGET);
  });

  it("is light: see-through, unlit by the sun, and casts no shadow", () => {
    const tile = buildBlastTile("dev");
    const glow = blastMaterial("dev");
    expect(tile.castShadow).toBe(false);
    expect(glow.transparent).toBe(true);
    expect(glow.opacity).toBeGreaterThan(0.3);
    expect(glow.opacity).toBeLessThan(1);
    expect(glow.depthWrite).toBe(false);
  });

  it.each(BRANCHES)("glows in the %s colour, brighter than the floor", (branch) => {
    const floor = new Color(BRANCH_COLOURS[branch]);
    const glow = blastMaterial(branch).color;
    expect(glow.r).toBeGreaterThanOrEqual(floor.r);
    expect(glow.g).toBeGreaterThanOrEqual(floor.g);
    expect(glow.b).toBeGreaterThanOrEqual(floor.b);
    // The branch's strongest channel is still the glow's strongest.
    const strongest = (c: Color): string =>
      c.r >= c.g && c.r >= c.b ? "r" : c.g >= c.b ? "g" : "b";
    expect(strongest(glow)).toBe(strongest(floor));
  });

  it("shares one geometry and one material per branch, ready for instancing", () => {
    expect(buildBlastTile("main").geometry).toBe(buildBlastTile("hotfix").geometry);
    expect(buildBlastTile("main").geometry).toBe(blastGeometry());
    expect(buildBlastTile("main").material).toBe(blastMaterial("main"));
    expect(blastMaterial("main")).not.toBe(blastMaterial("hotfix"));
    const instanced = new InstancedMesh(blastGeometry(), blastMaterial("feature"), 13);
    expect(instanced.count).toBe(13);
  });
});

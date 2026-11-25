import { Mesh, Vector3, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  BOX_SIZE,
  BOX_STAMP,
  buildBox,
  buildBoxDebris,
  paintBoxFace,
} from "../../../src/ui/models/box";
import { boundsOf, expectFitsTile, expectShared, isFinite3d } from "./helpers";

const BOX_TRIANGLE_BUDGET = 400;

describe("buildBox", () => {
  it("stands on its tile, about 0.8 on a side", () => {
    const box = buildBox();
    expectFitsTile(box, BOX_SIZE + 1e-6, 0.7);
    const size = boundsOf(box).getSize(new Vector3());
    expect(size.x).toBeCloseTo(BOX_SIZE, 5);
    expect(size.z).toBeCloseTo(BOX_SIZE, 5);
    expect(isFinite3d(box)).toBe(true);
  });

  it("stays under its triangle budget", () => {
    expect(countTriangles(buildBox())).toBeLessThan(BOX_TRIANGLE_BUDGET);
    expect(countTriangles(buildBoxDebris())).toBeLessThan(BOX_TRIANGLE_BUDGET);
  });

  it("shares its geometry and its printed material", () => {
    expectShared(buildBox(), buildBox());
    const carton = buildBox().getObjectByName("carton") as Mesh;
    expect((carton.material as MeshStandardMaterial).map).not.toBeNull();
  });
});

describe("the stamp", () => {
  it("says LEGACY and NÃO MEXER", () => {
    expect(BOX_STAMP).toEqual(["LEGACY", "NÃO MEXER"]);
  });

  it("prints dark ink above and below a light tape band", () => {
    const face = paintBoxFace();
    expect(face.width).toBe(face.height);
    const brightness = (x: number, y: number): number => {
      const [r, g, b] = face.get(x, y);
      return r + g + b;
    };
    const inkOnRow = (y: number): number => {
      let ink = 0;
      for (let x = 4; x < face.width - 4; x++) if (brightness(x, y) < 300) ink++;
      return ink;
    };
    // "LEGACY" at scale 3 starts at y = 14 + 2 accent rows; "NÃO MEXER" at y = 92.
    expect(inkOnRow(22)).toBeGreaterThan(20);
    expect(inkOnRow(100)).toBeGreaterThan(15);
    expect(inkOnRow(68)).toBe(0);
    expect(inkOnRow(50)).toBe(0);
    // The tape is lighter than the cardboard.
    expect(brightness(64, 68)).toBeGreaterThan(brightness(64, 50) + 60);
  });
});

describe("buildBoxDebris", () => {
  it("is a handful of pieces inside the box's volume, each with a way to fly", () => {
    const debris = buildBoxDebris();
    expect(debris.children.length).toBeGreaterThanOrEqual(4);
    const box = boundsOf(debris);
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.max.y).toBeLessThanOrEqual(BOX_SIZE + 0.1);
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.5);
    expect(isFinite3d(debris)).toBe(true);
    debris.children.forEach((piece, index) => {
      expect(piece.name).toBe(`piece${index}`);
      const [x, y, z] = piece.userData.direction as [number, number, number];
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
      expect(y).toBeGreaterThan(0);
    });
  });

  it("shares geometry and materials between two sets", () => {
    expectShared(buildBoxDebris(), buildBoxDebris());
  });
});

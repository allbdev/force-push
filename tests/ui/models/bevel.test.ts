import { Group, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  BEVEL,
  BEVEL_SLOT,
  CAP_SLOT,
  SIDE_SLOT,
  bevelBox,
  bevelFor,
  countTriangles,
  cylinder,
  material,
  namedGroup,
  part,
  plainBox,
  shade,
  torus,
  unitSphere,
} from "../../../src/ui/models/bevel";

describe("bevelBox", () => {
  it("is a chamfered box of 44 triangles with the asked size", () => {
    const geometry = bevelBox(0.9, 1.4, 0.8);
    expect(geometry.getAttribute("position").count).toBe(44 * 3);
    const box = geometry.boundingBox!;
    expect(box.min.toArray()).toEqual([-0.45, -0.7, -0.4].map((v) => expect.closeTo(v, 6)));
    expect(box.max.toArray()).toEqual([0.45, 0.7, 0.4].map((v) => expect.closeTo(v, 6)));
  });

  it("cuts the corners: no vertex sits on a corner of the plain box", () => {
    const positions = bevelBox(1, 1, 1).getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const onFaces = [positions.getX(i), positions.getY(i), positions.getZ(i)].filter(
        (v) => Math.abs(Math.abs(v) - 0.5) < 1e-6,
      ).length;
      expect(onFaces).toBe(1);
    }
  });

  it("has unit normals that point outward and wind counter-clockwise", () => {
    const geometry = bevelBox(0.5, 0.3, 0.7);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const [a, b, c, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      c.fromBufferAttribute(positions, i + 2);
      n.fromBufferAttribute(normals, i);
      expect(n.length()).toBeCloseTo(1, 5);
      expect(n.dot(a)).toBeGreaterThan(0);
      const winding = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      expect(winding.dot(n)).toBeCloseTo(1, 4);
    }
  });

  it("groups sides, caps and bevels into three material slots covering every triangle", () => {
    const geometry = bevelBox(1, 1, 1);
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([
      SIDE_SLOT,
      CAP_SLOT,
      BEVEL_SLOT,
    ]);
    expect(geometry.groups.map((group) => group.count / 3)).toEqual([8, 4, 32]);
    expect(geometry.groups[0]!.start).toBe(0);
  });

  it("maps the texture upright on each side: v follows y and stays inside 0..1", () => {
    const geometry = bevelBox(0.8, 0.8, 0.8);
    const positions = geometry.getAttribute("position");
    const uvs = geometry.getAttribute("uv");
    const sides = geometry.groups[0]!;
    for (let i = 0; i < positions.count; i++) {
      expect(uvs.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uvs.getX(i)).toBeLessThanOrEqual(1);
      expect(uvs.getY(i)).toBeGreaterThanOrEqual(0);
      expect(uvs.getY(i)).toBeLessThanOrEqual(1);
      if (i < sides.count) expect(uvs.getY(i)).toBeCloseTo(0.5 + positions.getY(i) / 0.8, 5);
    }
  });

  it("reads left to right from outside on the front face (+z): u grows with x", () => {
    const geometry = bevelBox(1, 1, 1);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uvs = geometry.getAttribute("uv");
    let checked = 0;
    for (let i = 0; i < positions.count; i++) {
      if (normals.getZ(i) > 0.99) {
        expect(uvs.getX(i)).toBeCloseTo(0.5 + positions.getX(i), 5);
        checked++;
      } else if (normals.getZ(i) < -0.99) {
        expect(uvs.getX(i)).toBeCloseTo(0.5 - positions.getX(i), 5);
        checked++;
      }
    }
    expect(checked).toBe(12);
  });

  it("returns the same geometry for the same size", () => {
    expect(bevelBox(0.3, 0.2, 0.1)).toBe(bevelBox(0.3, 0.2, 0.1));
    expect(bevelBox(0.3, 0.2, 0.1)).not.toBe(bevelBox(0.3, 0.2, 0.11));
  });

  it("uses a 3 cm bevel, and a smaller one on small parts", () => {
    expect(BEVEL).toBe(0.03);
    expect(bevelFor(1, 1, 1)).toBe(0.03);
    expect(bevelFor(1, 0.04, 1)).toBeCloseTo(0.01, 9);
  });
});

describe("the shared kit", () => {
  it("caches plain boxes, spheres, cylinders and tori", () => {
    expect(plainBox(0.1, 0.2, 0.3)).toBe(plainBox(0.1, 0.2, 0.3));
    expect(unitSphere(10, 8)).toBe(unitSphere(10, 8));
    expect(cylinder(0.1, 0.1, 0.2, 8)).toBe(cylinder(0.1, 0.1, 0.2, 8));
    expect(torus(0.3, 0.03, 6, 24)).toBe(torus(0.3, 0.03, 6, 24));
  });

  it("returns one material per colour and options", () => {
    const red = material("#ff0000");
    expect(material("#ff0000")).toBe(red);
    expect(material("#ff0000", { roughness: 0.2 })).not.toBe(red);
    const glow = material("#00ff00", { emissive: "#00ff00", emissiveIntensity: 2 });
    expect(glow.emissive.getHexString()).toBe("00ff00");
    expect(glow.emissiveIntensity).toBe(2);
  });

  it("shades a colour darker or lighter without leaving the gamut", () => {
    expect(shade("#ffffff", 1.5)).toBe("#ffffff");
    expect(shade("#3f8cff", 1)).toBe("#3f8cff");
    expect(shade("#808080", 0.5)).not.toBe("#808080");
    expect(shade("#808080", 0)).toBe("#000000");
  });

  it("makes parts that cast and receive shadows, and counts triangles", () => {
    const mesh = part(bevelBox(1, 1, 1), material("#ffffff"), 1, 2, 3, "thing");
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
    expect(mesh.position.toArray()).toEqual([1, 2, 3]);
    const group = namedGroup("pair", 0, 1, 0);
    group.add(mesh, part(plainBox(1, 1, 1), material("#ffffff")));
    expect(group).toBeInstanceOf(Group);
    expect(group.name).toBe("pair");
    expect(countTriangles(group)).toBe(44 + 12);
  });
});

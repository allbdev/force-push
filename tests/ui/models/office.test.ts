import { Mesh, type BufferGeometry, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCH_COLOURS } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  CHAIR_HEIGHT,
  OFFICE_CLEARANCE,
  PARTITION_HEIGHT,
  PLANT_HEIGHT,
  WATER_COOLER_HEIGHT,
  WHITEBOARD_HEIGHT,
  buildChair,
  buildOffice,
  buildPartition,
  buildPlant,
  buildWaterCooler,
  buildWhiteboard,
  buildWorkstation,
  glassMaterial,
} from "../../../src/ui/models/office";
import { boundsOf, expectShared, isFinite3d, materialsOf, meshesOf } from "./helpers";

const OFFICE_TRIANGLE_BUDGET = 25_000;
const OFFICE_DRAW_CALL_BUDGET = 24;

const pieces = [
  { name: "chair", build: buildChair, height: CHAIR_HEIGHT, parts: ["seat", "back", "base"] },
  { name: "plant", build: buildPlant, height: PLANT_HEIGHT, parts: ["pot", "leaves"] },
  {
    name: "partition",
    build: () => buildPartition(2),
    height: PARTITION_HEIGHT,
    parts: ["frame", "pane"],
  },
  {
    name: "workstation",
    build: () => buildWorkstation(0),
    height: 0.8,
    parts: ["top", "monitor", "screen"],
  },
  {
    name: "water-cooler",
    build: buildWaterCooler,
    height: WATER_COOLER_HEIGHT,
    parts: ["body", "bottle"],
  },
  {
    name: "whiteboard",
    build: buildWhiteboard,
    height: WHITEBOARD_HEIGHT,
    parts: ["board", "legs", "note"],
  },
] as const;

describe("office furniture", () => {
  it.each(pieces)(
    "builds the $name on the floor with its named parts",
    ({ name, build, height, parts }) => {
      const piece = build();
      expect(piece.name).toBe(name);
      const box = boundsOf(piece);
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
      expect(box.min.y).toBeLessThan(0.02);
      expect(box.max.y).toBeLessThanOrEqual(height + 1e-6);
      expect(box.max.y).toBeGreaterThan(height * 0.8);
      for (const part of parts) expect(piece.getObjectByName(part)).toBeDefined();
      expect(isFinite3d(piece)).toBe(true);
      expect(countTriangles(piece)).toBeLessThan(450);
      // One material per mesh, so the office can merge by material.
      for (const mesh of meshesOf(piece)) expect(Array.isArray(mesh.material)).toBe(false);
    },
  );

  it.each(pieces)("shares geometry and materials between two of the $name", ({ build }) => {
    expectShared(build(), build());
  });

  it("makes the partition as long as asked, with a see-through pane in a thin frame", () => {
    for (const length of [1, 2, 3]) {
      const box = boundsOf(buildPartition(length));
      expect(box.max.x - box.min.x).toBeCloseTo(length, 5);
      expect(box.max.z - box.min.z).toBeLessThan(0.08);
    }
    const pane = buildPartition(2).getObjectByName("pane") as Mesh;
    const glass = pane.material as MeshStandardMaterial;
    expect(glass).toBe(glassMaterial());
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBeLessThan(0.5);
    expect(glass.depthWrite).toBe(false);
    expect(pane.castShadow).toBe(false);
  });

  it("never lights a workstation in a branch colour: those desks are the players'", () => {
    const branchHexes = Object.values(BRANCH_COLOURS).map((c) => c.slice(1));
    for (let variant = 0; variant < 3; variant++) {
      const station = buildWorkstation(variant);
      const screen = (station.getObjectByName("screen") as Mesh).material as MeshStandardMaterial;
      expect(screen.emissiveIntensity).toBeGreaterThan(0);
      for (const mat of materialsOf(station)) {
        expect(branchHexes).not.toContain((mat as MeshStandardMaterial).color.getHexString());
      }
    }
    expect(buildWorkstation(1).getObjectsByProperty("name", "monitor")).toHaveLength(2);
    expect(buildWorkstation(-2).getObjectsByProperty("name", "monitor")).toHaveLength(2);
  });
});

describe("buildOffice", () => {
  const sizes = [
    [13, 11],
    [15, 13],
    [9, 9],
  ] as const;

  it.each(sizes)("dresses a %i × %i arena without touching the floor tiles", (width, height) => {
    const office = buildOffice(width, height);
    expect(office.name).toBe("office");
    expect(isFinite3d(office)).toBe(true);
    const floor = office.getObjectByName("floor") as Mesh;
    expect(floor.position.y).toBeLessThan(0);
    const floorBox = boundsOf(floor);
    expect(floorBox.min.x).toBeLessThan(-20);
    expect(floorBox.max.x).toBeGreaterThan(width + 20);

    // No vertex of the furniture or the glass is over the tiles or in the ring kept for the wall
    // and the four players' desks.
    const solid = meshesOf(office).filter((mesh) => mesh !== floor);
    expect(solid.length).toBeGreaterThan(3);
    let nearest = Infinity;
    for (const mesh of solid) {
      const positions = (mesh.geometry as BufferGeometry).getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeLessThan(1.4);
        const outside = Math.max(-0.5 - x, x - (width - 0.5), -0.5 - z, z - (height - 0.5));
        nearest = Math.min(nearest, outside);
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(OFFICE_CLEARANCE);
    expect(nearest).toBeLessThan(OFFICE_CLEARANCE + 1.5);
  });

  it("keeps the near side low so nothing covers the floor from the camera", () => {
    const [width, height] = [13, 11];
    const office = buildOffice(width, height);
    const floor = office.getObjectByName("floor");
    for (const mesh of meshesOf(office)) {
      if (mesh === floor) continue;
      const positions = (mesh.geometry as BufferGeometry).getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        if (positions.getZ(i) > height) expect(positions.getY(i)).toBeLessThan(0.95);
      }
    }
  });

  it.each(sizes)("stays inside the budget for a %i × %i arena", (width, height) => {
    const office = buildOffice(width, height);
    expect(countTriangles(office)).toBeLessThan(OFFICE_TRIANGLE_BUDGET);
    expect(countTriangles(office)).toBeGreaterThan(3_000);
    expect(meshesOf(office).length).toBeLessThanOrEqual(OFFICE_DRAW_CALL_BUDGET);
    // Merged: one mesh per material.
    const materials = meshesOf(office).map((mesh) => mesh.material);
    expect(new Set(materials).size).toBe(materials.length);
  });

  it("draws the glass after the furniture and lets everything else cast shadows", () => {
    const office = buildOffice(13, 11);
    const glass = office.getObjectByName("glass") as Mesh;
    expect(glass.material).toBe(glassMaterial());
    expect(glass.castShadow).toBe(false);
    expect(glass.renderOrder).toBeGreaterThan(0);
    const furniture = office.getObjectByName("furniture")!;
    expect(furniture.children.length).toBeGreaterThan(3);
    for (const mesh of meshesOf(furniture)) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
  });

  it("is the same every time and reuses the merged geometry", () => {
    const first = buildOffice(13, 11);
    const second = buildOffice(13, 11);
    expect(second).not.toBe(first);
    expect(meshesOf(second).map((m) => m.geometry)).toEqual(meshesOf(first).map((m) => m.geometry));
    const other = buildOffice(15, 13);
    expect(meshesOf(other)[1]!.geometry).not.toBe(meshesOf(first)[1]!.geometry);
  });
});

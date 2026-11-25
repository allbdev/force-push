import { Mesh, Vector3, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCH_COLOURS, FLOOR_GREY } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  PLATE_HEIGHT,
  PLATE_RADIUS,
  POWER_UP_KINDS,
  POWER_UP_RING_COLOURS,
  buildPowerUp,
} from "../../../src/ui/models/power-ups";
import { boundsOf, expectFitsTile, expectShared, isFinite3d } from "./helpers";

const POWER_UP_TRIANGLE_BUDGET = 900;

describe("buildPowerUp", () => {
  it("covers the five power-ups of the game plan", () => {
    expect(POWER_UP_KINDS).toEqual(["coffee", "duck", "stackOverflow", "secondMonitor", "rebase"]);
  });

  it.each(POWER_UP_KINDS)("builds %s on its tile, under the triangle budget", (kind) => {
    const powerUp = buildPowerUp(kind);
    expect(powerUp.name).toBe(`power-up-${kind}`);
    expect(powerUp.userData.kind).toBe(kind);
    expectFitsTile(powerUp, 0.65, 0.2);
    expect(isFinite3d(powerUp)).toBe(true);
    expect(countTriangles(powerUp)).toBeLessThan(POWER_UP_TRIANGLE_BUDGET);
  });

  it.each(POWER_UP_KINDS)("sits %s on a white plate with its coloured ring", (kind) => {
    const powerUp = buildPowerUp(kind);
    const plate = powerUp.getObjectByName("plate") as Mesh;
    const ring = powerUp.getObjectByName("ring") as Mesh;
    const item = powerUp.getObjectByName("item")!;
    expect(powerUp.children).toEqual([plate, ring, item]);

    const plateBox = boundsOf(plate);
    expect(plateBox.min.y).toBeCloseTo(0, 6);
    expect(plateBox.max.y).toBeCloseTo(PLATE_HEIGHT, 6);
    expect(plateBox.max.x).toBeCloseTo(PLATE_RADIUS, 2);
    const white = (plate.material as MeshStandardMaterial).color;
    expect(Math.min(white.r, white.g, white.b)).toBeGreaterThan(0.85);

    expect((ring.material as MeshStandardMaterial).color.getHexString()).toBe(
      POWER_UP_RING_COLOURS[kind].slice(1),
    );
    // The ring lies flat on the plate, inside its rim.
    const ringBox = boundsOf(ring);
    expect(ringBox.getSize(new Vector3()).y).toBeLessThan(0.05);
    expect(ringBox.max.x).toBeLessThan(plateBox.max.x);

    // The thing itself stands on the plate and inside it.
    const itemBox = boundsOf(item);
    expect(itemBox.min.y).toBeGreaterThanOrEqual(PLATE_HEIGHT - 1e-6);
    expect(itemBox.max.y).toBeGreaterThan(0.2);
    expect(Math.max(-itemBox.min.x, itemBox.max.x)).toBeLessThan(PLATE_RADIUS);
  });

  it("gives every ring its own colour, none of them a floor colour", () => {
    const rings = Object.values(POWER_UP_RING_COLOURS);
    expect(new Set(rings).size).toBe(POWER_UP_KINDS.length);
    for (const floor of [...Object.values(BRANCH_COLOURS), FLOOR_GREY]) {
      expect(rings).not.toContain(floor);
    }
  });

  it("shares geometry and materials between two of a kind, and the plate between kinds", () => {
    for (const kind of POWER_UP_KINDS) expectShared(buildPowerUp(kind), buildPowerUp(kind));
    const plate = (kind: (typeof POWER_UP_KINDS)[number]): Mesh =>
      buildPowerUp(kind).getObjectByName("plate") as Mesh;
    expect(plate("coffee").geometry).toBe(plate("rebase").geometry);
    expect(plate("coffee").material).toBe(plate("rebase").material);
  });

  it("builds five different items", () => {
    const shapes = POWER_UP_KINDS.map((kind) => {
      const size = boundsOf(buildPowerUp(kind).getObjectByName("item")!).getSize(new Vector3());
      return `${size.x.toFixed(3)} ${size.y.toFixed(3)} ${size.z.toFixed(3)}`;
    });
    expect(new Set(shapes).size).toBe(POWER_UP_KINDS.length);
  });
});

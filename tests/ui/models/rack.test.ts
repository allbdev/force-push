import { Mesh, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  RACK_HEIGHT,
  RACK_LED_FRAMES,
  RACK_LED_TICKS,
  RACK_VARIANTS,
  buildRack,
  rackLedFrame,
  rackLedMaterial,
  updateRackLeds,
} from "../../../src/ui/models/rack";
import { expectFitsTile, expectShared, isFinite3d } from "./helpers";

const RACK_TRIANGLE_BUDGET = 800;

describe("buildRack", () => {
  it("stands on its tile, about 1.4 tall", () => {
    const rack = buildRack();
    expectFitsTile(rack, RACK_HEIGHT + 1e-6, 1.3);
    expect(isFinite3d(rack)).toBe(true);
  });

  it("stays under its triangle budget", () => {
    expect(countTriangles(buildRack())).toBeLessThan(RACK_TRIANGLE_BUDGET);
  });

  it("shares geometry and materials between racks of a variant", () => {
    expectShared(buildRack(1), buildRack(1));
  });

  it("has a cabinet with the LED panel on its sides only", () => {
    const rack = buildRack(2);
    const cabinet = rack.getObjectByName("cabinet");
    expect(cabinet).toBeInstanceOf(Mesh);
    const materials = (cabinet as Mesh).material as MeshStandardMaterial[];
    expect(materials).toHaveLength(3);
    expect(materials[0]).toBe(rack.userData.leds);
    expect(materials[0]!.emissiveMap).not.toBeNull();
    expect(materials[1]!.map).toBeNull();
    expect(materials[2]!.map).toBeNull();
  });

  it("wraps the variant, so any integer picks one of the LED layouts", () => {
    expect(rackLedMaterial(RACK_VARIANTS)).toBe(rackLedMaterial(0));
    expect(rackLedMaterial(-1)).toBe(rackLedMaterial(RACK_VARIANTS - 1));
    expect(rackLedMaterial(1)).not.toBe(rackLedMaterial(0));
  });
});

describe("the LEDs", () => {
  it("paints lit LEDs on a dark panel, differently per variant", () => {
    const pixels = (variant: number): Uint8Array =>
      (rackLedMaterial(variant).map!.image as { data: Uint8Array }).data;
    const lit = (variant: number): number => {
      const data = pixels(variant);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 1]! > 200) count++;
      return count;
    };
    updateRackLeds(0);
    expect(lit(0)).toBeGreaterThan(40);
    expect(lit(0)).toBeLessThan(32 * 48 * 0.3);
    expect([...pixels(0)]).not.toEqual([...pixels(1)]);
  });

  it("steps through the frames every RACK_LED_TICKS ticks and loops", () => {
    expect(rackLedFrame(0, 0)).toBe(0);
    expect(rackLedFrame(RACK_LED_TICKS - 1, 0)).toBe(0);
    expect(rackLedFrame(RACK_LED_TICKS, 0)).toBe(1);
    expect(rackLedFrame(RACK_LED_TICKS * RACK_LED_FRAMES, 0)).toBe(0);
    expect(rackLedFrame(0, 1)).toBe(1);
    expect(rackLedFrame(-5, 0)).toBe(0);
  });

  it("blinks: updateRackLeds swaps the texture of every rack built", () => {
    const leds = buildRack(0).userData.leds as MeshStandardMaterial;
    updateRackLeds(0);
    const first = leds.map;
    updateRackLeds(1);
    expect(leds.map).toBe(first);
    updateRackLeds(RACK_LED_TICKS);
    expect(leds.map).not.toBe(first);
    expect(leds.emissiveMap).toBe(leds.map);
    updateRackLeds(RACK_LED_TICKS * RACK_LED_FRAMES);
    expect(leds.map).toBe(first);
  });
});

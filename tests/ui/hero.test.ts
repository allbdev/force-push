import { Mesh, PerspectiveCamera, Vector3, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import {
  HERO_BACKGROUND_LAYER,
  HERO_FOREGROUND_LAYER,
  buildHeroStage,
  heroFraming,
  heroFuseGlow,
  poseHero,
} from "../../src/ui/hero";
import { countTriangles, developerParts } from "../../src/ui/models";
import { boundsOf, isFinite3d } from "./models/helpers";

const HERO_TRIANGLE_BUDGET = 9_000;

function layersUnder(object: Object3D): Set<number> {
  const masks = new Set<number>();
  object.traverse((child) => masks.add(child.layers.mask));
  return masks;
}

/** Where a point lands on screen, in normalised device coordinates (−1..1, y up). */
function project(point: Vector3, aspect: number, seconds = 0): Vector3 {
  const framing = heroFraming(aspect, seconds);
  const camera = new PerspectiveCamera(framing.fov, aspect, 0.1, 80);
  camera.position.set(...framing.from);
  camera.lookAt(...framing.at);
  camera.updateMatrixWorld(true);
  return point.clone().project(camera);
}

describe("buildHeroStage (board 1)", () => {
  it("puts main and a force-push in front of a corridor of racks", () => {
    const stage = buildHeroStage();
    expect(stage.name).toBe("hero-stage");
    const developer = stage.getObjectByName("developer-main")!;
    const push = stage.getObjectByName("force-push-main")!;
    const backdrop = stage.getObjectByName("backdrop")!;
    expect(developer.position.toArray()).toEqual([0, 0, 0]);
    // Facing the camera, glasses on.
    expect(developerParts(developer).rig.rotation.y).toBe(0);
    expect(developerParts(developer).accessory.name).toBe("accessory");
    expect(backdrop.getObjectsByProperty("name", "rack").length).toBeGreaterThanOrEqual(10);
    expect(backdrop.getObjectByName("corridor")).toBeDefined();
    expect(backdrop.getObjectsByProperty("name", "contact-shadow")).toHaveLength(2);
    // The orb stands between him and the camera.
    expect(push.position.z).toBeGreaterThan(1);
    expect(push.position.z).toBeLessThan(heroFraming(16 / 9).from[2] - 0.8);
    expect(isFinite3d(stage)).toBe(true);
    expect(countTriangles(stage)).toBeLessThan(HERO_TRIANGLE_BUDGET);
  });

  it("keeps the figures on the sharp layer and everything else on the blurred one", () => {
    const stage = buildHeroStage();
    const fore = 1 << HERO_FOREGROUND_LAYER;
    const back = 1 << HERO_BACKGROUND_LAYER;
    expect([...layersUnder(stage.getObjectByName("developer-main")!)]).toEqual([fore]);
    expect([...layersUnder(stage.getObjectByName("force-push-main")!)]).toEqual([fore]);
    expect([...layersUnder(stage.getObjectByName("backdrop")!)]).toEqual([back]);
  });

  it("leaves the corridor clear: no rack on the three tiles he stands in", () => {
    const stage = buildHeroStage();
    for (const rack of stage.getObjectsByProperty("name", "rack")) {
      const box = boundsOf(rack);
      expect(Math.min(Math.abs(box.min.x), Math.abs(box.max.x))).toBeGreaterThan(1.4);
    }
  });
});

describe("poseHero", () => {
  const fuseScale = (stage: Object3D) => (stage.getObjectByName("fuse") as Mesh).scale.x;

  it("is a pure function of time, and time zero is the still frame with the fuse lit", () => {
    const a = buildHeroStage();
    const b = buildHeroStage();
    poseHero(a, 7.3);
    poseHero(a, 0);
    poseHero(b, 0);
    expect(fuseScale(a)).toBe(fuseScale(b));
    expect(developerParts(a.getObjectByName("developer-main")!).head.rotation.y).toBe(
      developerParts(b.getObjectByName("developer-main")!).head.rotation.y,
    );
    expect(heroFuseGlow(0)).toBeCloseTo(1, 6);
    const lit = fuseScale(a);
    poseHero(a, 1.25);
    expect(heroFuseGlow(1.25)).toBeCloseTo(0, 6);
    expect(fuseScale(a)).toBeLessThan(lit);
  });

  it("loops every 2.5 seconds and never leaves 0..1 or goes NaN", () => {
    const stage = buildHeroStage();
    for (let t = 0; t < 40; t += 0.37) {
      const glow = heroFuseGlow(t);
      expect(glow).toBeGreaterThanOrEqual(0);
      expect(glow).toBeLessThanOrEqual(1);
      expect(heroFuseGlow(t + 2.5)).toBeCloseTo(glow, 6);
      poseHero(stage, t);
    }
    poseHero(stage, 1e7);
    expect(isFinite3d(stage)).toBe(true);
  });

  it("only nudges him: the head turns a few degrees and the feet stay put", () => {
    const stage = buildHeroStage();
    const developer = stage.getObjectByName("developer-main")!;
    for (let t = 0; t < 30; t += 0.5) {
      poseHero(stage, t);
      expect(Math.abs(developerParts(developer).head.rotation.y)).toBeLessThan(0.25);
      expect(boundsOf(developer).min.y).toBeGreaterThan(-0.01);
    }
  });
});

describe("heroFraming", () => {
  const head = new Vector3(0, 0.67, 0);
  const stage = buildHeroStage();
  const orb = stage.getObjectByName("force-push-main")!.position.clone().setY(0.35);

  it("is low, close and level, like a photo taken from the floor of the corridor", () => {
    const f = heroFraming(16 / 9);
    expect(f.from[1]).toBeGreaterThan(0.3);
    expect(f.from[1]).toBeLessThan(1);
    expect(f.from[2]).toBeGreaterThan(3);
    expect(f.fov).toBeLessThanOrEqual(35);
  });

  it("keeps both figures right of centre on wide screens, clear of the text", () => {
    for (const aspect of [16 / 10, 16 / 9, 21 / 9]) {
      for (const point of [head, orb]) {
        const at = project(point, aspect);
        expect(at.x).toBeGreaterThan(0.05);
        expect(at.x).toBeLessThan(0.95);
        expect(Math.abs(at.y)).toBeLessThan(1);
      }
    }
  });

  it("centres them and backs off on portrait phones", () => {
    const wide = heroFraming(16 / 9);
    const tall = heroFraming(9 / 19.5);
    expect(tall.at[0]).toBeCloseTo(0, 9);
    expect(tall.from[2]).toBeGreaterThan(wide.from[2]);
    for (const point of [head, orb]) {
      const at = project(point, 9 / 19.5);
      expect(Math.abs(at.x)).toBeLessThan(0.8);
      expect(Math.abs(at.y)).toBeLessThan(1);
    }
  });

  it("sways by centimetres, never enough to lose the figures", () => {
    for (let t = 0; t < 60; t += 1.7) {
      const f = heroFraming(16 / 9, t);
      expect(Math.abs(f.from[0] - heroFraming(16 / 9).from[0])).toBeLessThan(0.05);
      expect(project(head, 16 / 9, t).x).toBeGreaterThan(0);
    }
  });
});

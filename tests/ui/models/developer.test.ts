import { Group, Mesh, Vector3, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCHES, BRANCH_COLOURS } from "../../../src/content/branches";
import { countTriangles } from "../../../src/ui/models/bevel";
import {
  DEVELOPER_MAX_HEIGHT,
  buildDeveloper,
  developerParts,
  poseDeveloper,
  setDuck,
  type DeveloperPose,
  type Facing,
} from "../../../src/ui/models/developer";
import { DUCK_HEIGHT } from "../../../src/ui/models/duck";
import {
  boundsOf,
  expectFitsTile,
  expectShared,
  geometriesOf,
  isFinite3d,
  materialsOf,
} from "./helpers";

const DEVELOPER_TRIANGLE_BUDGET = 1500;
const FACINGS: readonly Facing[] = [0, 1, 2, 3];
const STANDING: DeveloperPose = { walkPhase: 0, falling: 0, facing: 2 };
/** Height with the duck on the head (it is part of the model, hidden until `setDuck`). */
const MAX_HEIGHT_WITH_DUCK = DEVELOPER_MAX_HEIGHT + DUCK_HEIGHT;

describe("buildDeveloper", () => {
  it.each(BRANCHES)("builds %s standing in the middle of the tile", (branch) => {
    const developer = buildDeveloper(branch);
    expect(developer.name).toBe(`developer-${branch}`);
    expect(developer.userData.branch).toBe(branch);
    expectFitsTile(developer, MAX_HEIGHT_WITH_DUCK, 0.75);
    expect(isFinite3d(developer)).toBe(true);
  });

  it.each(BRANCHES)("%s is about 0.8 to 0.95 tall without the duck", (branch) => {
    const developer = buildDeveloper(branch);
    const parts = developerParts(developer);
    parts.duck.removeFromParent();
    const height = boundsOf(developer).max.y;
    expect(height).toBeGreaterThan(0.8);
    expect(height).toBeLessThanOrEqual(DEVELOPER_MAX_HEIGHT);
  });

  it.each(BRANCHES)("%s stays under the triangle budget", (branch) => {
    expect(countTriangles(buildDeveloper(branch))).toBeLessThan(DEVELOPER_TRIANGLE_BUDGET);
  });

  it.each(BRANCHES)("%s has the named parts the renderer relies on", (branch) => {
    const developer = buildDeveloper(branch);
    const parts = developerParts(developer);
    for (const name of ["head", "body", "armL", "armR", "legL", "legR", "accessory", "duck"]) {
      const found = developer.getObjectByName(name);
      expect(found, name).toBeDefined();
      expect(parts[name as "head"]).toBe(found);
    }
    expect(parts.rig).toBeInstanceOf(Group);
    expect(parts.tilt.parent).toBe(parts.rig);
    // The character's left is +x when they face the camera.
    expect(parts.armL.position.x).toBeGreaterThan(0);
    expect(parts.armR.position.x).toBeLessThan(0);
    expect(parts.legL.position.x).toBeGreaterThan(0);
    expect(parts.legR.position.x).toBeLessThan(0);
  });

  it.each(BRANCHES)("%s wears a hoodie in the branch colour", (branch) => {
    const torso = buildDeveloper(branch).getObjectByName("torso") as Mesh;
    expect((torso.material as MeshStandardMaterial).color.getHexString()).toBe(
      BRANCH_COLOURS[branch].slice(1),
    );
  });

  it("gives each branch its accessory: glasses, headphones, laptop, cap and beard", () => {
    const parent = (branch: (typeof BRANCHES)[number]): string =>
      developerParts(buildDeveloper(branch)).accessory.parent!.name;
    expect(parent("main")).toBe("head");
    expect(parent("feature")).toBe("head");
    expect(parent("hotfix")).toBe("body");
    expect(parent("dev")).toBe("head");
    const dev = buildDeveloper("dev");
    expect(dev.getObjectByName("brim")).toBeDefined();
    expect(dev.getObjectByName("beard")).toBeDefined();
    expect(buildDeveloper("hotfix").getObjectByName("bun")).toBeDefined();
    // Four different kits.
    const sizes = BRANCHES.map(
      (branch) => developerParts(buildDeveloper(branch)).accessory.children.length,
    );
    expect(new Set(sizes).size).toBeGreaterThanOrEqual(3);
  });

  it("shares geometry and materials across two builds of a branch", () => {
    for (const branch of BRANCHES) expectShared(buildDeveloper(branch), buildDeveloper(branch));
  });

  it("shares the kit between branches (trousers, shoes, limb geometry)", () => {
    const main = buildDeveloper("main");
    const dev = buildDeveloper("dev");
    const sharedMaterials = [...materialsOf(main)].filter((m) => materialsOf(dev).has(m));
    const sharedGeometry = [...geometriesOf(main)].filter((g) => geometriesOf(dev).has(g));
    expect(sharedMaterials.length).toBeGreaterThanOrEqual(3);
    expect(sharedGeometry.length).toBeGreaterThanOrEqual(8);
  });

  it("refuses to pose something that is not a developer", () => {
    expect(() => poseDeveloper(new Group(), STANDING)).toThrow(/buildDeveloper/);
  });
});

describe("poseDeveloper", () => {
  it("swings arms and legs through the walk cycle, opposite limbs together", () => {
    const developer = buildDeveloper("main");
    const parts = developerParts(developer);
    poseDeveloper(developer, { ...STANDING, walkPhase: 0.25 });
    expect(Math.abs(parts.legL.rotation.x)).toBeGreaterThan(0.3);
    expect(parts.legR.rotation.x).toBeCloseTo(-parts.legL.rotation.x, 9);
    expect(Math.abs(parts.armL.rotation.x)).toBeGreaterThan(0.3);
    expect(Math.sign(parts.armL.rotation.x)).toBe(-Math.sign(parts.legL.rotation.x));
    expect(Math.sign(parts.armR.rotation.x)).toBe(Math.sign(parts.legL.rotation.x));

    const quarter = parts.legL.rotation.x;
    poseDeveloper(developer, { ...STANDING, walkPhase: 0.75 });
    expect(parts.legL.rotation.x).toBeCloseTo(-quarter, 9);
    poseDeveloper(developer, { ...STANDING, walkPhase: 0.5 });
    expect(parts.legL.rotation.x).toBeCloseTo(0, 9);
  });

  it("moves the feet: a walking pose has a different silhouette from standing", () => {
    const developer = buildDeveloper("feature");
    const foot = new Vector3();
    const shoe = developerParts(developer).legL.children[1]!;
    developer.updateMatrixWorld(true);
    const standingZ = shoe.getWorldPosition(foot).z;
    poseDeveloper(developer, { ...STANDING, walkPhase: 0.25 });
    developer.updateMatrixWorld(true);
    expect(Math.abs(shoe.getWorldPosition(foot).z - standingZ)).toBeGreaterThan(0.08);
  });

  it("is absolute: the same pose gives the same result whatever came before", () => {
    const developer = buildDeveloper("dev");
    const snapshot = (): number[] => {
      developer.updateMatrixWorld(true);
      const parts = developerParts(developer);
      return [parts.head, parts.armL, parts.armR, parts.legL, parts.legR].flatMap(
        (limb) => limb.matrixWorld.elements,
      );
    };
    const pose: DeveloperPose = { walkPhase: 0.3, falling: 0.2, facing: 1 };
    poseDeveloper(developer, pose);
    const first = snapshot();
    poseDeveloper(developer, { walkPhase: 0.9, falling: 1, facing: 3, cheer: 1 });
    poseDeveloper(developer, pose);
    expect(snapshot()).toEqual(first);
  });

  it.each(BRANCHES)("keeps %s inside the tile in every facing and walk phase", (branch) => {
    const developer = buildDeveloper(branch);
    for (const facing of FACINGS) {
      for (const walkPhase of [0, 0.125, 0.25, 0.5, 0.75, 0.999]) {
        poseDeveloper(developer, { walkPhase, falling: 0, facing });
        expectFitsTile(developer, MAX_HEIGHT_WITH_DUCK + 0.03, 0.75);
      }
    }
  });

  it("turns to face up, right, down and left on screen (−z, +x, +z, −x)", () => {
    const developer = buildDeveloper("dev");
    const brim = developer.getObjectByName("brim")!;
    const expected: Record<Facing, [number, number]> = {
      0: [0, -1],
      1: [1, 0],
      2: [0, 1],
      3: [-1, 0],
    };
    const at = new Vector3();
    for (const facing of FACINGS) {
      poseDeveloper(developer, { ...STANDING, facing });
      developer.updateMatrixWorld(true);
      brim.getWorldPosition(at);
      const length = Math.hypot(at.x, at.z);
      expect(at.x / length).toBeCloseTo(expected[facing][0], 5);
      expect(at.z / length).toBeCloseTo(expected[facing][1], 5);
    }
  });

  it.each(BRANCHES)("lays %s flat on the floor when falling reaches 1", (branch) => {
    const developer = buildDeveloper(branch);
    developerParts(developer).duck.removeFromParent();
    for (const facing of FACINGS) {
      poseDeveloper(developer, { walkPhase: 0.25, falling: 1, facing });
      const box = boundsOf(developer);
      expect(box.max.y).toBeLessThan(0.5);
      expect(box.min.y).toBeGreaterThanOrEqual(-0.02);
      // Lying across the tile, not sticking far out of it.
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(0.62);
      expect(isFinite3d(developer)).toBe(true);
    }
    // No walking on your back.
    expect(developerParts(developer).legL.rotation.x).toBeCloseTo(0, 9);
  });

  it("falls gradually and clamps out-of-range values", () => {
    const developer = buildDeveloper("main");
    const parts = developerParts(developer);
    const steps = [0, 0.25, 0.5, 0.75, 1].map((falling) => {
      poseDeveloper(developer, { ...STANDING, falling });
      return { lean: -parts.tilt.rotation.x, top: boundsOf(parts.head).max.y };
    });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.lean).toBeGreaterThan(steps[i - 1]!.lean);
    }
    expect(steps[2]!.top).toBeLessThan(steps[0]!.top);
    expect(steps[4]!.top).toBeLessThan(steps[2]!.top);
    poseDeveloper(developer, { ...STANDING, falling: 7 });
    expect(parts.tilt.rotation.x).toBeCloseTo(-Math.PI / 2, 9);
    poseDeveloper(developer, { ...STANDING, falling: -3 });
    expect(parts.tilt.rotation.x).toBeCloseTo(0, 9);
  });

  it("raises both hands above the head to cheer", () => {
    const developer = buildDeveloper("feature");
    const parts = developerParts(developer);
    const hand = parts.armL.getObjectByName("hand")!;
    const at = new Vector3();
    developer.updateMatrixWorld(true);
    expect(hand.getWorldPosition(at).y).toBeLessThan(0.4);
    poseDeveloper(developer, { ...STANDING, cheer: 1 });
    developer.updateMatrixWorld(true);
    expect(hand.getWorldPosition(at).y).toBeGreaterThan(0.65);
    expect(parts.armR.rotation.x).toBeCloseTo(parts.armL.rotation.x, 9);
  });

  it("keeps hotfix's hands on the laptop while walking", () => {
    const developer = buildDeveloper("hotfix");
    const parts = developerParts(developer);
    for (const walkPhase of [0, 0.25, 0.75]) {
      poseDeveloper(developer, { ...STANDING, walkPhase });
      expect(parts.armL.rotation.x).toBeLessThan(-0.5);
      expect(parts.armR.rotation.x).toBeLessThan(-0.5);
    }
  });
});

describe("setDuck", () => {
  it("shows and hides the rubber duck on the head", () => {
    const developer = buildDeveloper("hotfix");
    const duck = developerParts(developer).duck;
    expect(duck.visible).toBe(false);
    setDuck(developer, true);
    expect(duck.visible).toBe(true);
    expect(duck.parent!.name).toBe("head");
    expect(boundsOf(duck).min.y).toBeGreaterThan(0.8);
    setDuck(developer, false);
    expect(duck.visible).toBe(false);
  });
});

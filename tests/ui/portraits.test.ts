import { Mesh, PerspectiveCamera, Vector3, type MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import { BRANCHES, BRANCH_COLOURS } from "../../src/content/branches";
import { DEVELOPER_MAX_HEIGHT, countTriangles, developerParts } from "../../src/ui/models";
import {
  PORTRAIT_MAX_SIZE,
  PORTRAIT_MIN_SIZE,
  buildPortraitStage,
  portraitFraming,
  renderPortraits,
} from "../../src/ui/portraits";
import { boundsOf, isFinite3d } from "./models/helpers";

describe("buildPortraitStage (board 2)", () => {
  it.each(BRANCHES)("stands %s on a slab of their colour", (branch) => {
    const stage = buildPortraitStage(branch);
    expect(stage.name).toBe(`portrait-${branch}`);
    const developer = stage.getObjectByName(`developer-${branch}`)!;
    const slab = stage.getObjectByName("slab") as Mesh;
    expect(stage.getObjectByName("ground")).toBeDefined();
    expect(boundsOf(slab).max.y).toBeCloseTo(0, 5);
    const feet = boundsOf(developer);
    expect(feet.min.y).toBeGreaterThan(-0.02);
    expect(feet.min.y).toBeLessThan(0.05);
    // Standing inside the slab's edges.
    expect(feet.min.x).toBeGreaterThan(boundsOf(slab).min.x);
    expect(feet.max.x).toBeLessThan(boundsOf(slab).max.x);
    const top = (slab.material as MeshStandardMaterial[])[1]!;
    expect(top.color.getHexString()).toBe(BRANCH_COLOURS[branch].slice(1));
    expect(isFinite3d(stage)).toBe(true);
    expect(countTriangles(stage)).toBeLessThan(2_500);
  });

  it("gives each of them their own pose", () => {
    const arm = (branch: (typeof BRANCHES)[number]) =>
      developerParts(buildPortraitStage(branch).getObjectByName(`developer-${branch}`)!).armL
        .rotation.x;
    // feature waves; main stands at ease; hotfix holds the laptop up.
    expect(arm("feature")).toBeLessThan(-2);
    expect(Math.abs(arm("main"))).toBeLessThan(0.1);
    expect(arm("hotfix")).toBeLessThan(-0.5);
    const dev = buildPortraitStage("dev").getObjectByName("developer-dev")!;
    expect(developerParts(dev).legL.rotation.x).not.toBe(0);
  });

  it("builds a fresh figure each time: posing one portrait never moves another", () => {
    const first = buildPortraitStage("feature");
    const second = buildPortraitStage("feature");
    expect(first.getObjectByName("developer-feature")).not.toBe(
      second.getObjectByName("developer-feature"),
    );
  });
});

describe("portraitFraming", () => {
  it.each(BRANCHES)("fits %s in a square picture, head to slab", (branch) => {
    const framing = portraitFraming();
    const camera = new PerspectiveCamera(framing.fov, 1, 0.1, 30);
    camera.position.set(...framing.from);
    camera.lookAt(...framing.at);
    camera.updateMatrixWorld(true);
    // The standing figure's box (the hidden duck aside): shoulders wide, feet to the top of the head.
    expect(buildPortraitStage(branch).getObjectByName("duck")!.visible).toBe(false);
    let top = -Infinity;
    for (const x of [-0.32, 0.32]) {
      for (const y of [0, DEVELOPER_MAX_HEIGHT]) {
        for (const z of [-0.2, 0.25]) {
          const at = new Vector3(x, y, z).project(camera);
          expect(Math.abs(at.x)).toBeLessThan(1);
          expect(Math.abs(at.y)).toBeLessThan(1);
          top = Math.max(top, at.y);
        }
      }
    }
    // And fills most of it.
    expect(top).toBeGreaterThan(0.45);
  });
});

describe("renderPortraits", () => {
  it("rejects where there is no WebGL (here: no DOM at all), once per size", async () => {
    const first = renderPortraits(256);
    await expect(first).rejects.toBeInstanceOf(Error);
    expect(renderPortraits(256)).toBe(first);
  });

  it("clamps the size it is asked for", async () => {
    const huge = renderPortraits(1e9);
    const tiny = renderPortraits(-4);
    const junk = renderPortraits(Number.NaN);
    expect(renderPortraits(PORTRAIT_MAX_SIZE)).toBe(huge);
    expect(renderPortraits(PORTRAIT_MIN_SIZE)).toBe(tiny);
    expect(junk).toBe(tiny);
    await Promise.allSettled([huge, tiny]);
  });
});

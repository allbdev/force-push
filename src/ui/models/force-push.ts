/**
 * The force-push (boards "Landing" and "Items and blocks"): a dark glossy orb with two bands in
 * the branch colour and a fuse light on a stalk. The one sphere in an office of boxes.
 */
import { Mesh, type Group, type MeshStandardMaterial, type Object3D } from "three";
import { BRANCH_COLOURS, type Branch } from "../../content/branches";
import { cylinder, material, namedGroup, part, torus, unitSphere } from "./bevel";

export const ORB_RADIUS = 0.3;
/** How many glow steps the fuse light has (shared materials, dimmest first). */
export const FUSE_LEVELS = 5;

/** The bands stand 4 cm proud of the orb; the ball rests on them. */
const ORB_Y = ORB_RADIUS + 0.05;
const FUSE_Y = ORB_Y + ORB_RADIUS + 0.1;
const FUSE_RADIUS = 0.05;
/** The light blinks this many times over the whole fuse, faster towards the end. */
const FUSE_BLINKS = 7;

function fuseMaterial(level: number): MeshStandardMaterial {
  return material("#f4dc8a", {
    roughness: 0.4,
    emissive: "#ffd866",
    emissiveIntensity: 0.25 + (level / (FUSE_LEVELS - 1)) * 2.2,
  });
}

/** A force-push sitting on y = 0. Children: `ball` (orb and bands), `stalk`, `fuse`. */
export function buildForcePush(branch: Branch): Group {
  const colour = BRANCH_COLOURS[branch];
  const push = namedGroup(`force-push-${branch}`);
  const shell = material("#141c2b", { roughness: 0.18 });
  const band = material(colour, { roughness: 0.45, emissive: colour, emissiveIntensity: 0.3 });
  const metal = material("#8f99a3", { roughness: 0.4, metalness: 0.5 });

  const ball = namedGroup("ball", 0, ORB_Y, 0);
  const orb = part(unitSphere(20, 14), shell, 0, 0, 0, "orb");
  orb.scale.setScalar(ORB_RADIUS);
  ball.add(orb);
  const ring = torus(ORB_RADIUS + 0.002, 0.042, 6, 24);
  const equator = part(ring, band, 0, 0, 0, "band");
  equator.rotation.x = Math.PI / 2;
  const meridian = part(ring, band, 0, 0, 0, "band");
  meridian.rotation.y = Math.PI / 2;
  ball.add(equator, meridian);
  push.add(ball);

  push.add(part(cylinder(0.022, 0.022, 0.1, 8), metal, 0, ORB_Y + ORB_RADIUS + 0.04, 0, "stalk"));
  const fuse = part(unitSphere(10, 8), fuseMaterial(0), 0, FUSE_Y, 0, "fuse");
  fuse.scale.setScalar(FUSE_RADIUS);
  push.add(fuse);
  push.userData.branch = branch;
  return push;
}

/** 0..1: how bright the fuse light is with `remaining01` of the fuse left (1 = just dropped). */
export function fusePulse(remaining01: number): number {
  const burnt = 1 - Math.min(1, Math.max(0, remaining01));
  // The phase grows with the square of the burn, so the blinks come closer together.
  return 0.5 - 0.5 * Math.cos(burnt * burnt * FUSE_BLINKS * Math.PI * 2);
}

/**
 * Blinks the fuse light and swells the orb as the fuse burns down. A pure function of
 * `remaining01` (1 = just dropped, 0 = about to blow), so replays look the same.
 */
export function setFuse(push: Object3D, remaining01: number): void {
  const burnt = 1 - Math.min(1, Math.max(0, remaining01));
  const pulse = fusePulse(remaining01);
  const fuse = push.getObjectByName("fuse");
  const ball = push.getObjectByName("ball");
  if (fuse instanceof Mesh) {
    fuse.material = fuseMaterial(Math.round(pulse * (FUSE_LEVELS - 1)));
    fuse.scale.setScalar(FUSE_RADIUS * (1 + pulse * (0.3 + 0.5 * burnt)));
  }
  if (ball) {
    const swell = 1 + pulse * 0.07 * burnt;
    ball.scale.setScalar(swell);
    ball.position.y = ORB_Y * swell; // grows from the floor up
  }
}

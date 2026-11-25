/**
 * The four developers (board "The branches"): blocky toy people in hoodies. The hoodie is the
 * branch colour so a player reads from above. `main` wears glasses, `feature` red headphones,
 * `hotfix` holds a laptop, `dev` has a cap and a beard.
 *
 * A developer is a rig: `root > rig (facing) > tilt (falling) > head, body, arms, legs`. The
 * renderer moves the root; `poseDeveloper` sets everything below it from a pose and nothing else.
 */
import type { Group, MeshStandardMaterial, Object3D } from "three";
import { BRANCH_COLOURS, type Branch } from "../../content/branches";
import { bevelBox, material, namedGroup, part, plainBox, shade } from "./bevel";
import { buildDuck } from "./duck";

/** Screen directions: 0 up (−z), 1 right (+x), 2 down (+z), 3 left (−x). */
export type Facing = 0 | 1 | 2 | 3;

export interface DeveloperPose {
  /** Where in the two-step walk cycle, 0..1 (0 and 0.5 are the passing poses). */
  walkPhase: number;
  /** 0 standing, 1 flat on the floor (reverted). */
  falling: number;
  facing: Facing;
  /** 0..1, both arms up (lobby, result). Optional. */
  cheer?: number;
}

/** The parts the renderer and `poseDeveloper` reach for, kept on `userData.parts`. */
export interface DeveloperParts {
  rig: Group;
  tilt: Group;
  head: Group;
  body: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
  accessory: Object3D;
  duck: Object3D;
  /** The arms' resting angles (hotfix holds the laptop) and how far they swing. */
  arms: { restX: number; restZ: number; swing: number };
}

/** Standing height without the duck: the tallest (hotfix's bun) is about 0.94. */
export const DEVELOPER_MAX_HEIGHT = 0.95;

const HIP_Y = 0.26;
const SHOULDER_Y = 0.51;
const SHOULDER_X = 0.235;
const NECK_Y = 0.53;
const FACE_Z = 0.152;
const EYE_Y = 0.15;
/** How far the back of the model is behind its axis: it rests on this when flat. */
const BACK_DEPTH = 0.17;
/** Slides the fallen body back over its tile (it falls backwards from its feet). */
const FALL_SHIFT = 0.42;
const LEG_SWING = 0.65;
/** The toe of the shoe, from the hip: it swings lowest, so the body rises to keep it on the floor. */
const TOE_Z = 0.117;
const TOE_REACH = Math.hypot(HIP_Y, TOE_Z);
const TOE_ANGLE = Math.atan2(TOE_Z, HIP_Y);
const ARM_SWING = 0.75;
const ARM_SPLAY = 0.08;
const FACING_ANGLES: readonly [number, number, number, number] = [
  Math.PI,
  Math.PI / 2,
  0,
  -Math.PI / 2,
];

interface Look {
  skin: string;
  hair: string;
  /** Top of the hair or cap above the neck, where the duck sits. */
  crown: number;
}

const LOOKS: Readonly<Record<Branch, Look>> = {
  main: { skin: "#d8bfa3", hair: "#2b2320", crown: 0.34 },
  feature: { skin: "#8d5a3b", hair: "#18181c", crown: 0.4 },
  hotfix: { skin: "#efe0cb", hair: "#8c4a24", crown: 0.41 },
  dev: { skin: "#d6ab7f", hair: "#1c1d22", crown: 0.36 },
};

const BLACK = "#121317";

function eyes(head: Group, black: MeshStandardMaterial): void {
  for (const side of [-1, 1]) {
    head.add(part(plainBox(0.036, 0.062, 0.012), black, side * 0.075, EYE_Y, FACE_Z));
  }
}

/** main: square black frames with a bridge and temples; the lenses double as the eyes. */
function glasses(head: Group, black: MeshStandardMaterial): Object3D {
  const frames = namedGroup("accessory", 0, EYE_Y, FACE_Z);
  const lens = material("#dfe6ee", { roughness: 0.2 });
  for (const side of [-1, 1]) {
    frames.add(part(plainBox(0.105, 0.09, 0.014), black, side * 0.08, 0, 0));
    frames.add(part(plainBox(0.07, 0.055, 0.016), lens, side * 0.08, 0, 0.002));
    frames.add(part(plainBox(0.026, 0.055, 0.018), black, side * 0.08, 0, 0.003));
    frames.add(part(plainBox(0.014, 0.018, 0.16), black, side * 0.172, 0.02, -0.075));
  }
  frames.add(part(plainBox(0.06, 0.016, 0.014), black, 0, 0.005, 0));
  head.add(frames);
  return frames;
}

/** feature: red cups over the ears and a band over the flat-top. */
function headphones(head: Group): Object3D {
  const set = namedGroup("accessory");
  const red = material("#e23d3d", { roughness: 0.45 });
  const band = material("#26272d", { roughness: 0.5 });
  for (const side of [-1, 1]) {
    set.add(part(bevelBox(0.055, 0.15, 0.14, 0.018), red, side * 0.195, 0.16, 0));
    set.add(part(plainBox(0.026, 0.14, 0.07), band, side * 0.2, 0.3, 0));
  }
  set.add(part(bevelBox(0.426, 0.035, 0.09, 0.012), band, 0, 0.385, 0));
  head.add(set);
  return set;
}

/** hotfix: an open laptop held in front of the chest, screen out. */
function laptop(body: Group, black: MeshStandardMaterial): Object3D {
  const held = namedGroup("accessory", 0, 0.385, 0.21);
  const shell = material("#c5d0dc", { roughness: 0.35, metalness: 0.3 });
  const screen = material("#07080b", { roughness: 0.15, emissive: "#1b2a4a" });
  held.add(part(bevelBox(0.28, 0.2, 0.022, 0.008), shell, 0, 0.01, 0));
  held.add(part(plainBox(0.24, 0.15, 0.006), screen, 0, 0.022, 0.012));
  held.add(part(plainBox(0.24, 0.02, 0.008), black, 0, -0.07, 0.012));
  held.rotation.x = -0.12;
  body.add(held);
  return held;
}

/** dev: a flat cap with a brim, and a block of beard. */
function capAndBeard(head: Group, black: MeshStandardMaterial): Object3D {
  const kit = namedGroup("accessory");
  const cap = material("#1c1d22", { roughness: 0.7 });
  kit.add(part(bevelBox(0.37, 0.12, 0.33), cap, 0, 0.3, -0.005));
  kit.add(part(bevelBox(0.33, 0.035, 0.13, 0.012), cap, 0, 0.255, 0.2, "brim"));
  kit.add(part(bevelBox(0.3, 0.105, 0.05, 0.015), black, 0, 0.06, 0.14, "beard"));
  head.add(kit);
  return kit;
}

function hair(head: Group, branch: Branch, colour: MeshStandardMaterial): void {
  if (branch === "dev") return; // under the cap
  const height = branch === "feature" ? 0.13 : 0.09;
  const width = branch === "hotfix" ? 0.37 : 0.36;
  head.add(part(bevelBox(width, height, 0.325), colour, 0, 0.25 + height / 2, -0.004));
  head.add(part(bevelBox(width, 0.2, 0.05, 0.015), colour, 0, 0.19, -0.14));
  if (branch === "hotfix") {
    head.add(part(bevelBox(0.13, 0.08, 0.13), colour, 0, 0.37, -0.02, "bun"));
    for (const side of [-1, 1]) {
      head.add(part(bevelBox(0.04, 0.15, 0.18, 0.012), colour, side * 0.168, 0.2, -0.04));
    }
  }
}

function limb(name: string, x: number, y: number): Group {
  return namedGroup(name, x, y, 0);
}

/** A developer standing on y = 0 in the middle of their tile, facing +z (down the screen). */
export function buildDeveloper(branch: Branch): Group {
  const look = LOOKS[branch];
  const colour = BRANCH_COLOURS[branch];
  const hoodie = material(colour, { roughness: 0.8 });
  const pocket = material(shade(colour, 0.78), { roughness: 0.8 });
  const skin = material(look.skin, { roughness: 0.7 });
  const hairColour = material(look.hair, { roughness: 0.8 });
  const trousers = material("#1b2030", { roughness: 0.8 });
  const shoes = material("#eef1f5", { roughness: 0.5 });
  const cord = material("#f4f5f7", { roughness: 0.6 });
  const black = material(BLACK, { roughness: 0.4 });

  const root = namedGroup(`developer-${branch}`);
  const rig = namedGroup("rig");
  const tilt = namedGroup("tilt");
  root.add(rig);
  rig.add(tilt);

  const legs = [-1, 1].map((side) => {
    const leg = limb(side < 0 ? "legR" : "legL", side * 0.085, HIP_Y);
    leg.add(part(bevelBox(0.125, 0.21, 0.14, 0.02), trousers, 0, -0.105, 0));
    leg.add(part(bevelBox(0.135, 0.065, 0.19, 0.02), shoes, 0, -HIP_Y + 0.0325, 0.022));
    return leg;
  });

  const body = namedGroup("body");
  body.add(part(bevelBox(0.36, 0.29, 0.23), hoodie, 0, 0.385, 0, "torso"));
  body.add(part(bevelBox(0.3, 0.09, 0.1, 0.02), hoodie, 0, 0.505, -0.1, "hood"));
  body.add(part(plainBox(0.2, 0.075, 0.012), pocket, 0, 0.305, 0.116, "pocket"));
  for (const side of [-1, 1]) {
    body.add(part(plainBox(0.014, 0.075, 0.012), cord, side * 0.035, 0.455, 0.116));
  }

  const arms = [-1, 1].map((side) => {
    const arm = limb(side < 0 ? "armR" : "armL", side * SHOULDER_X, SHOULDER_Y);
    arm.add(part(bevelBox(0.105, 0.23, 0.125, 0.022), hoodie, 0, -0.095, 0));
    arm.add(part(bevelBox(0.085, 0.065, 0.1, 0.018), skin, 0, -0.235, 0, "hand"));
    return arm;
  });

  const head = namedGroup("head", 0, NECK_Y, 0);
  head.add(part(bevelBox(0.34, 0.28, 0.3), skin, 0, 0.14, 0, "skull"));
  hair(head, branch, hairColour);
  if (branch !== "main") eyes(head, black);

  let accessory: Object3D;
  if (branch === "main") accessory = glasses(head, black);
  else if (branch === "feature") accessory = headphones(head);
  else if (branch === "hotfix") accessory = laptop(body, black);
  else accessory = capAndBeard(head, black);

  const duck = buildDuck(0.8);
  duck.position.set(0, look.crown, 0);
  duck.visible = false;
  head.add(duck);

  tilt.add(legs[0]!, legs[1]!, body, arms[0]!, arms[1]!, head);

  const parts: DeveloperParts = {
    rig,
    tilt,
    head,
    body,
    armR: arms[0]!,
    armL: arms[1]!,
    legR: legs[0]!,
    legL: legs[1]!,
    accessory,
    duck,
    arms:
      branch === "hotfix"
        ? { restX: -0.72, restZ: -0.3, swing: 0.12 }
        : { restX: 0, restZ: ARM_SPLAY, swing: ARM_SWING },
  };
  root.userData.parts = parts;
  root.userData.branch = branch;
  poseDeveloper(root, { walkPhase: 0, falling: 0, facing: 2 });
  return root;
}

/** The named parts of a developer built by `buildDeveloper`. */
export function developerParts(developer: Object3D): DeveloperParts {
  const parts = developer.userData.parts as DeveloperParts | undefined;
  if (!parts) throw new Error("Not a developer model: build it with buildDeveloper().");
  return parts;
}

function clamp01(value: number): number {
  return value > 1 ? 1 : value > 0 ? value : 0;
}

/**
 * Sets the whole pose from scratch (so it is safe to call every frame with any pose): which way
 * they face, arms and legs swinging through the walk cycle, and lying down as `falling` reaches 1.
 */
export function poseDeveloper(developer: Object3D, pose: DeveloperPose): void {
  const parts = developerParts(developer);
  const fall = clamp01(pose.falling);
  const cheer = clamp01(pose.cheer ?? 0);
  const upright = 1 - fall;
  const swing = Math.sin(pose.walkPhase * Math.PI * 2) * upright;
  const lean = (fall * Math.PI) / 2;
  const down = Math.sin(lean);

  parts.rig.rotation.y = FACING_ANGLES[pose.facing];
  parts.tilt.rotation.x = -lean;
  // Two small rises per cycle keep the swinging feet on the floor; resting on the back when down.
  const stride = swing * LEG_SWING;
  const rise = TOE_REACH * Math.cos(Math.abs(stride) - TOE_ANGLE) - HIP_Y;
  parts.tilt.position.set(0, BACK_DEPTH * down + rise, FALL_SHIFT * down);

  parts.legL.rotation.x = stride;
  parts.legR.rotation.x = -stride;

  const { restX, restZ, swing: reach } = parts.arms;
  const raised = -2.95 * cheer;
  const base = restX * (1 - cheer) + raised;
  const splay = restZ * (1 - cheer) + 0.25 * cheer + 0.9 * fall;
  parts.armL.rotation.set(base - swing * reach * (1 - cheer), 0, splay);
  parts.armR.rotation.set(base + swing * reach * (1 - cheer), 0, -splay);
}

/** Shows or hides the rubber duck on the developer's head (the shield power-up). */
export function setDuck(developer: Object3D, on: boolean): void {
  developerParts(developer).duck.visible = on;
}

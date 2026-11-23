/**
 * The power-ups (board "Items and blocks", GAME_PLAN.md §6.4). Each sits on a white plate with a
 * coloured ring so it reads on any painted floor. The thing itself is the `item` group, which the
 * renderer can bob or turn without moving the plate.
 */
import type { Group } from "three";
import { bevelBox, cylinder, material, namedGroup, part, plainBox, torus } from "./bevel";
import { buildDuck } from "./duck";

export const POWER_UP_KINDS = [
  "coffee",
  "duck",
  "stackOverflow",
  "secondMonitor",
  "rebase",
] as const;
export type PowerUpKind = (typeof POWER_UP_KINDS)[number];

/** The ring around each plate. */
export const POWER_UP_RING_COLOURS: Readonly<Record<PowerUpKind, string>> = {
  coffee: "#8a5a33",
  duck: "#d9b21c",
  stackOverflow: "#e2641c",
  secondMonitor: "#5fb4cc",
  rebase: "#8b63d6",
};

export const PLATE_RADIUS = 0.38;
/** Top of the plate, where the item stands. */
export const PLATE_HEIGHT = 0.05;

function plate(kind: PowerUpKind, into: Group): void {
  const white = material("#f3f4f6", { roughness: 0.4 });
  const ring = material(POWER_UP_RING_COLOURS[kind], { roughness: 0.5 });
  into.add(
    part(
      cylinder(PLATE_RADIUS - 0.02, PLATE_RADIUS, PLATE_HEIGHT, 24),
      white,
      0,
      0.025,
      0,
      "plate",
    ),
  );
  const band = part(torus(0.3, 0.036, 6, 24), ring, 0, PLATE_HEIGHT, 0, "ring");
  band.rotation.x = Math.PI / 2;
  band.scale.z = 0.45; // squashed flat onto the plate (z is up after the turn)
  into.add(band);
}

/** A white mug of coffee with a handle. */
function coffee(item: Group): void {
  const china = material("#f1f1ee", { roughness: 0.35 });
  const brew = material("#3b2415", { roughness: 0.3 });
  item.add(part(cylinder(0.105, 0.09, 0.2, 14), china, 0, 0.1, 0, "mug"));
  item.add(part(cylinder(0.088, 0.088, 0.01, 14), brew, 0, 0.198, 0, "coffee"));
  const handle = part(torus(0.055, 0.017, 5, 8, Math.PI), china, 0.1, 0.105, 0, "handle");
  handle.rotation.z = -Math.PI / 2;
  item.add(handle);
}

/** A stack of orange bars fanning up from a grey tray. */
function stackOverflow(item: Group): void {
  const tray = material("#9aa3ad", { roughness: 0.5, metalness: 0.2 });
  const bar = material("#f08a3c", { roughness: 0.55 });
  item.add(part(bevelBox(0.34, 0.035, 0.2, 0.01), tray, 0, 0.0175, 0, "tray"));
  for (let i = 0; i < 5; i++) {
    const plank = part(bevelBox(0.26, 0.034, 0.1, 0.008), bar, i * i * 0.006, 0.06 + i * 0.05, 0);
    plank.rotation.z = i * 0.13;
    item.add(plank);
  }
}

/** A monitor on a stand, its screen lit. */
function secondMonitor(item: Group): void {
  const dark = material("#23262e", { roughness: 0.5, metalness: 0.2 });
  const screen = material("#63b9cf", {
    roughness: 0.25,
    emissive: "#63b9cf",
    emissiveIntensity: 0.35,
  });
  item.add(part(bevelBox(0.18, 0.02, 0.12, 0.006), dark, 0, 0.01, 0));
  item.add(part(plainBox(0.035, 0.14, 0.03), dark, 0, 0.09, -0.01));
  item.add(part(bevelBox(0.38, 0.25, 0.035, 0.01), dark, 0, 0.27, 0));
  item.add(part(plainBox(0.34, 0.21, 0.006), screen, 0, 0.27, 0.018, "screen"));
}

/** A little commit graph: two commits on a line and one moved onto its tip. */
function rebase(item: Group): void {
  const commit = material("#8b63d6", {
    roughness: 0.4,
    emissive: "#8b63d6",
    emissiveIntensity: 0.25,
  });
  const line = material("#3a3350", { roughness: 0.6 });
  const node = bevelBox(0.11, 0.11, 0.11, 0.02);
  item.add(part(plainBox(0.03, 0.3, 0.03), line, -0.08, 0.2, 0));
  const branch = part(plainBox(0.03, 0.24, 0.03), line, 0.02, 0.34, 0);
  branch.rotation.z = -0.9;
  item.add(branch);
  item.add(part(node, commit, -0.08, 0.075, 0));
  item.add(part(node, commit, -0.08, 0.27, 0));
  item.add(part(node, commit, 0.12, 0.42, 0));
}

/** A power-up on its plate, standing on y = 0. Children: `plate`, `ring`, `item`. */
export function buildPowerUp(kind: PowerUpKind): Group {
  const powerUp = namedGroup(`power-up-${kind}`);
  plate(kind, powerUp);
  const item = namedGroup("item", 0, PLATE_HEIGHT, 0);
  if (kind === "coffee") coffee(item);
  else if (kind === "duck") item.add(buildDuck(1.35));
  else if (kind === "stackOverflow") stackOverflow(item);
  else if (kind === "secondMonitor") secondMonitor(item);
  else rebase(item);
  powerUp.add(item);
  powerUp.userData.kind = kind;
  return powerUp;
}

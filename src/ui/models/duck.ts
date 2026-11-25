/**
 * The rubber duck (board "Items and blocks"): the power-up on its plate and, smaller, the one a
 * protected player wears. With the orb and the mug it is one of the few round things in the office.
 */
import type { Group } from "three";
import { bevelBox, material, namedGroup, part, plainBox, unitSphere } from "./bevel";

/** Size of the duck at scale 1: about 0.3 long, 0.28 tall, facing +z. */
export const DUCK_LENGTH = 0.3;
export const DUCK_HEIGHT = 0.28;

/** A duck sitting on y = 0, facing +z. */
export function buildDuck(scale = 1): Group {
  const duck = namedGroup("duck");
  const yellow = material("#f2d93b", { roughness: 0.45 });
  const orange = material("#f08a2c", { roughness: 0.5 });
  const black = material("#15161a", { roughness: 0.4 });
  const sphere = unitSphere(10, 8);

  const body = part(sphere, yellow, 0, 0.09, -0.02);
  body.scale.set(0.105, 0.09, 0.13);
  const tail = part(bevelBox(0.07, 0.05, 0.07, 0.015), yellow, 0, 0.15, -0.13);
  tail.rotation.x = -0.6;
  const head = part(sphere, yellow, 0, 0.2, 0.06);
  head.scale.setScalar(0.078);
  duck.add(body, tail, head);
  duck.add(part(bevelBox(0.055, 0.024, 0.05, 0.008), orange, 0, 0.19, 0.145, "beak"));
  for (const side of [-1, 1]) {
    duck.add(part(plainBox(0.012, 0.022, 0.022), black, side * 0.074, 0.215, 0.085));
  }
  duck.scale.setScalar(scale);
  return duck;
}

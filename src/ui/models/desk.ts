/**
 * A developer's desk for the four corners (board "Match"): white top, dark legs, a monitor
 * glowing in the branch colour and a mug in it, so you can tell whose desk it is.
 */
import type { Group } from "three";
import { BRANCH_COLOURS, type Branch } from "../../content/branches";
import { bevelBox, material, namedGroup, part, plainBox } from "./bevel";

export const DESK_WIDTH = 0.92;
export const DESK_DEPTH = 0.56;
/** Height of the desk top's surface. */
export const DESK_HEIGHT = 0.4;

/** A desk on its tile, the monitor facing +z (down the screen). */
export function buildDesk(branch: Branch): Group {
  const colour = BRANCH_COLOURS[branch];
  const desk = namedGroup(`desk-${branch}`);
  const white = material("#eef0f4", { roughness: 0.6 });
  const dark = material("#2a2e38", { roughness: 0.6, metalness: 0.2 });
  const glow = material(colour, { roughness: 0.3, emissive: colour, emissiveIntensity: 0.55 });
  const accent = material(colour, { roughness: 0.6 });

  const topThickness = 0.05;
  desk.add(
    part(
      bevelBox(DESK_WIDTH, topThickness, DESK_DEPTH, 0.012),
      white,
      0,
      DESK_HEIGHT - topThickness / 2,
      0,
      "top",
    ),
  );
  const legHeight = DESK_HEIGHT - topThickness;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      desk.add(
        part(
          bevelBox(0.05, legHeight, 0.05, 0.01),
          dark,
          x * (DESK_WIDTH / 2 - 0.06),
          legHeight / 2,
          z * (DESK_DEPTH / 2 - 0.06),
        ),
      );
    }
  }
  // The branch-coloured edge strip along the front of the top.
  desk.add(
    part(
      plainBox(DESK_WIDTH - 0.06, 0.02, 0.012),
      accent,
      0,
      DESK_HEIGHT - topThickness / 2,
      DESK_DEPTH / 2 + 0.002,
      "accent",
    ),
  );

  const monitor = namedGroup("monitor", -0.12, DESK_HEIGHT, -0.12);
  monitor.add(part(bevelBox(0.18, 0.02, 0.12, 0.006), dark, 0, 0.01, 0));
  monitor.add(part(plainBox(0.035, 0.12, 0.03), dark, 0, 0.08, -0.01));
  monitor.add(part(bevelBox(0.4, 0.25, 0.035, 0.01), dark, 0, 0.245, 0));
  monitor.add(part(plainBox(0.36, 0.21, 0.006), glow, 0, 0.245, 0.018, "screen"));
  desk.add(monitor);

  desk.add(part(bevelBox(0.26, 0.015, 0.1, 0.005), dark, -0.12, DESK_HEIGHT + 0.0075, 0.14));
  desk.add(part(bevelBox(0.07, 0.085, 0.07, 0.012), accent, 0.3, DESK_HEIGHT + 0.0425, 0.1, "mug"));
  return desk;
}

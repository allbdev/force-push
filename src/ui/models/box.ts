/**
 * The legacy box (board "Items and blocks"): a cardboard carton with a tape band and the
 * "LEGACY · NÃO MEXER" stencil on every face. It breaks when a blast reaches it (GAME_PLAN.md §6.1).
 */
import { MeshStandardMaterial, type Group } from "three";
import { bevelBox, material, namedGroup, part } from "./bevel";
import { PixelGrid, seededRandom, textWidth, type Rgb } from "./pixel-texture";

export const BOX_SIZE = 0.8;

/** The stamp is the same in both locales: it is set dressing, the joke of the Brazilian office. */
export const BOX_STAMP = ["LEGACY", "NÃO MEXER"] as const;

const TEXTURE_SIZE = 128;
const CARDBOARD = "#c8a46c";
const CARD: Rgb = [200, 164, 108];
const CARD_EDGE: Rgb = [176, 141, 88];
const TAPE: Rgb = [226, 212, 178];
const TAPE_EDGE: Rgb = [205, 189, 152];
const INK: Rgb = [112, 82, 44];

let cartonMaterial: MeshStandardMaterial | undefined;

/** The carton face: cardboard grain, "LEGACY", the tape band, "NÃO MEXER". */
export function paintBoxFace(): PixelGrid {
  const grid = new PixelGrid(TEXTURE_SIZE, TEXTURE_SIZE);
  const random = seededRandom(0xca87);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    // Corrugated cardboard: faint horizontal streaks.
    const streak = Math.round((random() - 0.5) * 10);
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const grain = streak + Math.round((random() - 0.5) * 6);
      grid.set(x, y, [CARD[0] + grain, CARD[1] + grain, CARD[2] + grain]);
    }
  }
  const edge = 3;
  grid.rect(0, 0, TEXTURE_SIZE, edge, CARD_EDGE);
  grid.rect(0, TEXTURE_SIZE - edge, TEXTURE_SIZE, edge, CARD_EDGE);
  grid.rect(0, 0, edge, TEXTURE_SIZE, CARD_EDGE);
  grid.rect(TEXTURE_SIZE - edge, 0, edge, TEXTURE_SIZE, CARD_EDGE);

  const centred = (text: string, scale: number): number =>
    Math.round((TEXTURE_SIZE - textWidth(text, scale)) / 2);
  grid.text(centred(BOX_STAMP[0], 3), 14, BOX_STAMP[0], 3, INK);
  grid.rect(0, 58, TEXTURE_SIZE, 22, TAPE);
  grid.rect(0, 58, TEXTURE_SIZE, 1, TAPE_EDGE);
  grid.rect(0, 79, TEXTURE_SIZE, 1, TAPE_EDGE);
  grid.text(centred(BOX_STAMP[1], 2), 92, BOX_STAMP[1], 2, INK);
  return grid;
}

function carton(): MeshStandardMaterial {
  cartonMaterial ??= new MeshStandardMaterial({
    map: paintBoxFace().toTexture(false),
    roughness: 0.9,
  });
  return cartonMaterial;
}

/** A legacy box standing on its tile. */
export function buildBox(): Group {
  const box = namedGroup("box");
  box.add(part(bevelBox(BOX_SIZE, BOX_SIZE, BOX_SIZE), carton(), 0, BOX_SIZE / 2, 0, "carton"));
  return box;
}

/** Where each flap of a broken box starts, and the way it flies (`userData.direction`, unit vector). */
const DEBRIS: readonly { at: readonly [number, number, number]; spin: number }[] = [
  { at: [-0.22, 0.5, -0.18], spin: 0.4 },
  { at: [0.2, 0.55, -0.2], spin: -0.7 },
  { at: [-0.2, 0.3, 0.2], spin: 1.1 },
  { at: [0.22, 0.28, 0.18], spin: -0.3 },
  { at: [0, 0.68, 0.02], spin: 0.9 },
  { at: [0.02, 0.24, -0.02], spin: -1.3 },
];

/**
 * The pieces a box breaks into: six cardboard flaps inside the box's volume. Each piece carries
 * `userData.direction` (a unit `[x, y, z]`, outward and up) for the renderer to throw it along.
 */
export function buildBoxDebris(): Group {
  const debris = namedGroup("box-debris");
  const cardboard = material(CARDBOARD, { roughness: 0.9 });
  const tape = material("#e2d4b2", { roughness: 0.8 });
  DEBRIS.forEach(({ at, spin }, index) => {
    const flap = part(
      bevelBox(0.3, 0.04, 0.24),
      index === 4 ? tape : cardboard,
      at[0],
      at[1],
      at[2],
      `piece${index}`,
    );
    flap.rotation.set(spin, spin * 2, spin * 0.5);
    const out = [at[0], at[1] - BOX_SIZE / 2 + 0.6, at[2]] as const;
    const length = Math.hypot(out[0], out[1], out[2]);
    flap.userData.direction = [out[0] / length, out[1] / length, out[2] / length];
    debris.add(flap);
  });
  return debris;
}

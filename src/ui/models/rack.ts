/**
 * The server rack (board "Items and blocks"): a dark cabinet a tile wide with a grid of blinking
 * LEDs on its four sides. Racks never break and stop blasts (GAME_PLAN.md §6.1).
 */
import { MeshStandardMaterial, type DataTexture, type Group } from "three";
import { bevelBox, material, namedGroup, part } from "./bevel";
import { PixelGrid, seededRandom, type Rgb } from "./pixel-texture";

export const RACK_WIDTH = 0.9;
export const RACK_HEIGHT = 1.4;

/** Racks come in a few LED layouts so a row of them doesn't blink in step. */
export const RACK_VARIANTS = 3;
/** Each layout loops through this many frames, one every `RACK_LED_TICKS` ticks. */
export const RACK_LED_FRAMES = 4;
export const RACK_LED_TICKS = 8;

const LED_TEXTURE_WIDTH = 32;
const LED_TEXTURE_HEIGHT = 48;
const PANEL: Rgb = [13, 18, 26];
const SHELF: Rgb = [30, 38, 50];
const LED_OFF: Rgb = [24, 34, 44];
const LED_GREEN: Rgb = [120, 255, 170];
const LED_YELLOW: Rgb = [255, 214, 90];
const LED_TEAL: Rgb = [90, 225, 215];

const ledFrames = new Map<number, DataTexture[]>();
const ledMaterials = new Map<number, MeshStandardMaterial>();

function paintLedFrames(variant: number): DataTexture[] {
  const random = seededRandom(0x5eed + variant * 977);
  // Every LED position with its colour and whether it starts lit.
  const leds: { x: number; y: number; colour: Rgb; lit: boolean }[] = [];
  for (let y = 3; y < LED_TEXTURE_HEIGHT - 3; y += 3) {
    for (let x = 3; x < LED_TEXTURE_WIDTH - 3; x += 2) {
      if (x === 21 || x === 23) continue; // the gap between the two LED blocks of a shelf
      const pick = random();
      const colour = pick < 0.68 ? LED_GREEN : pick < 0.9 ? LED_YELLOW : LED_TEAL;
      leds.push({ x, y, colour, lit: random() < (x > 23 ? 0.35 : 0.72) });
    }
  }
  const frames: DataTexture[] = [];
  for (let frame = 0; frame < RACK_LED_FRAMES; frame++) {
    const grid = new PixelGrid(LED_TEXTURE_WIDTH, LED_TEXTURE_HEIGHT);
    grid.rect(0, 0, LED_TEXTURE_WIDTH, LED_TEXTURE_HEIGHT, PANEL);
    for (let y = 5; y < LED_TEXTURE_HEIGHT - 2; y += 3) {
      grid.rect(2, y, LED_TEXTURE_WIDTH - 4, 1, SHELF);
    }
    for (const led of leds) {
      if (frame > 0 && random() < 0.14) led.lit = !led.lit;
      grid.set(led.x, led.y, led.lit ? led.colour : LED_OFF);
    }
    frames.push(grid.toTexture(true));
  }
  return frames;
}

function framesFor(variant: number): DataTexture[] {
  let frames = ledFrames.get(variant);
  if (!frames) {
    frames = paintLedFrames(variant);
    ledFrames.set(variant, frames);
  }
  return frames;
}

/** The shared LED panel material of a variant; `updateRackLeds` swaps its texture. */
export function rackLedMaterial(variant: number): MeshStandardMaterial {
  const index = ((Math.trunc(variant) % RACK_VARIANTS) + RACK_VARIANTS) % RACK_VARIANTS;
  let leds = ledMaterials.get(index);
  if (!leds) {
    const first = framesFor(index)[0]!;
    leds = new MeshStandardMaterial({
      map: first,
      emissiveMap: first,
      emissive: "#ffffff",
      emissiveIntensity: 1.1,
      roughness: 0.45,
      metalness: 0.1,
    });
    ledMaterials.set(index, leds);
  }
  return leds;
}

/** A rack standing on its tile. `userData.leds` is its (shared) LED material. */
export function buildRack(variant = 0): Group {
  const rack = namedGroup("rack");
  const leds = rackLedMaterial(variant);
  const shell = material("#1d2129", { roughness: 0.55, metalness: 0.2 });
  const top = material("#464c59", { roughness: 0.6, metalness: 0.2 });
  rack.add(
    part(
      bevelBox(RACK_WIDTH, RACK_HEIGHT, RACK_WIDTH),
      [leds, top, shell],
      0,
      RACK_HEIGHT / 2,
      0,
      "cabinet",
    ),
  );
  rack.userData.leds = leds;
  return rack;
}

/** Which LED frame a variant shows at a tick. */
export function rackLedFrame(tick: number, variant: number): number {
  const step = Math.floor(Math.max(0, tick) / RACK_LED_TICKS) + variant;
  return step % RACK_LED_FRAMES;
}

/** Blinks the LEDs of every rack built so far. Call once per rendered tick, not per rack. */
export function updateRackLeds(tick: number): void {
  for (const [variant, leds] of ledMaterials) {
    const texture = framesFor(variant)[rackLedFrame(tick, variant)]!;
    leds.map = texture;
    leds.emissiveMap = texture;
  }
}

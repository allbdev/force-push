/**
 * Pixel masks for the floor patterns, and the textures made from them (white with darker marks,
 * multiplied by the tile colour). No canvas: plain pixels, so the masks are unit-tested.
 */
import { DataTexture, NearestFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace } from "three";
import { PATTERN_DARKEN, type FloorPattern } from "../content/floor-patterns";

export const PATTERN_SIZE = 32;

/** True where the pattern marks the tile (x right, y down, 0..size-1). */
/**
 * True where the pattern marks the tile (x right, y down, 0..size-1). Geometry from the canvas
 * page "Floor patterns", in fractions of the tile side.
 */
export function patternMask(
  pattern: FloorPattern,
  x: number,
  y: number,
  size = PATTERN_SIZE,
): boolean {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;
  switch (pattern) {
    case "solid":
      return false;
    case "stripes": {
      // Centred on u+v = 1/4, 3/4, 5/4, 7/4; each 1/4 wide along u+v (bottom-left to top-right).
      const d = (u + v) * 2 - 0.5; // 0 at the first centre, 1 per stripe
      return Math.abs(d - Math.round(d)) < 0.25;
    }
    case "dots": {
      const centres = [1 / 6, 1 / 2, 5 / 6];
      return centres.some((cx) => centres.some((cy) => (u - cx) ** 2 + (v - cy) ** 2 < 0.085 ** 2));
    }
    case "lines": {
      const bars = [
        [0.2, 0.14, 0.62],
        [0.4, 0.26, 0.82],
        [0.6, 0.26, 0.58],
        [0.8, 0.14, 0.46],
      ] as const;
      return bars.some(([cy, from, to]) => Math.abs(v - cy) < 0.0425 && u >= from && u <= to);
    }
  }
}

const cache = new Map<FloorPattern, DataTexture>();

export function patternTexture(pattern: FloorPattern): DataTexture {
  let tex = cache.get(pattern);
  if (tex) return tex;
  const data = new Uint8Array(PATTERN_SIZE * PATTERN_SIZE * 4);
  const dark = Math.round(255 * (1 - PATTERN_DARKEN));
  for (let y = 0; y < PATTERN_SIZE; y++) {
    for (let x = 0; x < PATTERN_SIZE; x++) {
      const v = patternMask(pattern, x, y) ? dark : 255;
      const i = ((PATTERN_SIZE - 1 - y) * PATTERN_SIZE + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  tex = new DataTexture(data, PATTERN_SIZE, PATTERN_SIZE, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  cache.set(pattern, tex);
  return tex;
}

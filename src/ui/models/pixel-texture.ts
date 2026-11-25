/**
 * Textures painted pixel by pixel into a `DataTexture`: no image files and no canvas, so the
 * models build in Node. Includes the small stencil font for the "LEGACY · NÃO MEXER" stamp.
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

export type Rgb = readonly [number, number, number];

/** Glyph cell: 5 wide, 9 tall (two accent rows, then seven for the letter). */
export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 9;
const BLANK = "00000";

const LETTERS: Readonly<Record<string, readonly string[]>> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  " ": [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK],
};
const TILDE = ["01101", "10110"] as const;

/** The nine rows of a glyph, top first. `Ã` is `A` under a tilde. Unknown characters are blank. */
export function glyphRows(character: string): readonly string[] {
  const accented = character === "Ã";
  const letter = LETTERS[accented ? "A" : character] ?? LETTERS[" "]!;
  return [...(accented ? TILDE : [BLANK, BLANK]), ...letter];
}

/** Width in pixels of a line of text at a scale (one blank column between glyphs). */
export function textWidth(text: string, scale: number): number {
  const count = [...text].length;
  return count === 0 ? 0 : (count * (GLYPH_WIDTH + 1) - 1) * scale;
}

/** An RGBA pixel grid. `y` runs down from the top, as you would draw it. */
export class PixelGrid {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  set(x: number, y: number, colour: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    // Texture rows run bottom to top.
    const offset = ((this.height - 1 - y) * this.width + x) * 4;
    this.data[offset] = colour[0];
    this.data[offset + 1] = colour[1];
    this.data[offset + 2] = colour[2];
    this.data[offset + 3] = 255;
  }

  get(x: number, y: number): Rgb {
    const offset = ((this.height - 1 - y) * this.width + x) * 4;
    return [this.data[offset] ?? 0, this.data[offset + 1] ?? 0, this.data[offset + 2] ?? 0];
  }

  rect(x: number, y: number, width: number, height: number, colour: Rgb): void {
    for (let j = y; j < y + height; j++) {
      for (let i = x; i < x + width; i++) this.set(i, j, colour);
    }
  }

  /** Draws a line of text with its top-left corner at `x`, `y`. */
  text(x: number, y: number, text: string, scale: number, colour: Rgb): void {
    let left = x;
    for (const character of text) {
      glyphRows(character).forEach((row, j) => {
        for (let i = 0; i < GLYPH_WIDTH; i++) {
          if (row[i] === "1") this.rect(left + i * scale, y + j * scale, scale, scale, colour);
        }
      });
      left += (GLYPH_WIDTH + 1) * scale;
    }
  }

  /** `crisp` keeps hard pixel edges up close (LEDs); otherwise the texture is smoothed (print). */
  toTexture(crisp: boolean): DataTexture {
    const texture = new DataTexture(
      this.data,
      this.width,
      this.height,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = crisp ? NearestFilter : LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
}

/** A small seeded generator (mulberry32) so painted textures are the same on every load. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

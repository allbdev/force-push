import { NearestFilter, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import {
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  PixelGrid,
  glyphRows,
  seededRandom,
  textWidth,
} from "../../../src/ui/models/pixel-texture";

describe("the stencil font", () => {
  it("has a 5 x 9 glyph for every letter of the box stamp", () => {
    for (const character of "LEGACY NÃO MEXER") {
      const rows = glyphRows(character);
      expect(rows).toHaveLength(GLYPH_HEIGHT);
      for (const row of rows) expect(row).toMatch(new RegExp(`^[01]{${GLYPH_WIDTH}}$`));
      if (character !== " ") expect(rows.join("")).toContain("1");
    }
  });

  it("draws the tilde of Ã in the accent rows, over a plain A", () => {
    expect(glyphRows("Ã").slice(2)).toEqual(glyphRows("A").slice(2));
    expect(glyphRows("A").slice(0, 2).join("")).not.toContain("1");
    expect(glyphRows("Ã").slice(0, 2).join("")).toContain("1");
  });

  it("draws nothing for a character it does not know", () => {
    expect(glyphRows("?").join("")).not.toContain("1");
  });

  it("measures a line of text", () => {
    expect(textWidth("", 2)).toBe(0);
    expect(textWidth("L", 1)).toBe(5);
    expect(textWidth("LEGACY", 3)).toBe(105);
    expect(textWidth("NÃO MEXER", 2)).toBe(106);
  });
});

describe("PixelGrid", () => {
  it("stores pixels top-down for the caller and bottom-up for the texture", () => {
    const grid = new PixelGrid(4, 3);
    grid.set(1, 0, [10, 20, 30]);
    expect(grid.get(1, 0)).toEqual([10, 20, 30]);
    const offset = (2 * 4 + 1) * 4;
    expect([...grid.data.slice(offset, offset + 4)]).toEqual([10, 20, 30, 255]);
  });

  it("ignores pixels outside the grid", () => {
    const grid = new PixelGrid(2, 2);
    grid.rect(-5, -5, 20, 20, [1, 2, 3]);
    grid.set(9, 9, [9, 9, 9]);
    expect(grid.get(0, 0)).toEqual([1, 2, 3]);
    expect(grid.get(1, 1)).toEqual([1, 2, 3]);
  });

  it("draws text at a scale", () => {
    const grid = new PixelGrid(16, 20);
    grid.text(1, 0, "L", 2, [255, 0, 0]);
    // The L's stem starts under the two accent rows (4 px at scale 2).
    expect(grid.get(1, 3)).toEqual([0, 0, 0]);
    expect(grid.get(1, 4)).toEqual([255, 0, 0]);
    expect(grid.get(2, 5)).toEqual([255, 0, 0]);
    expect(grid.get(3, 5)).toEqual([0, 0, 0]);
    expect(grid.get(10, 17)).toEqual([255, 0, 0]);
  });

  it("becomes an sRGB data texture, crisp or smooth", () => {
    const grid = new PixelGrid(8, 4);
    const crisp = grid.toTexture(true);
    expect(crisp.image.width).toBe(8);
    expect(crisp.image.height).toBe(4);
    expect(crisp.colorSpace).toBe(SRGBColorSpace);
    expect(crisp.magFilter).toBe(NearestFilter);
    expect(grid.toTexture(false).magFilter).not.toBe(NearestFilter);
  });
});

describe("seededRandom", () => {
  it("gives the same numbers in 0..1 for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const other = seededRandom(43);
    const first = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(first);
    expect(Array.from({ length: 50 }, () => other())).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

import { describe, expect, it } from "vitest";
import { FLOOR_PATTERNS } from "../../src/content/floor-patterns";
import { BRANCHES } from "../../src/content/branches";
import { patternMask, patternTexture, PATTERN_SIZE } from "../../src/ui/floor-texture";

const coverage = (p: Parameters<typeof patternMask>[0]) => {
  let n = 0;
  for (let y = 0; y < PATTERN_SIZE; y++)
    for (let x = 0; x < PATTERN_SIZE; x++) if (patternMask(p, x, y)) n++;
  return n / (PATTERN_SIZE * PATTERN_SIZE);
};

describe("floor patterns", () => {
  it("give every branch a distinct pattern, main solid", () => {
    expect(FLOOR_PATTERNS.main).toBe("solid");
    expect(new Set(BRANCHES.map((b) => FLOOR_PATTERNS[b])).size).toBe(4);
  });

  it("mark a visible but small part of the tile", () => {
    expect(coverage("solid")).toBe(0);
    for (const p of ["stripes", "dots", "lines"] as const) {
      expect(coverage(p), p).toBeGreaterThan(0.04);
      expect(coverage(p), p).toBeLessThan(0.55);
    }
  });

  it("stripes run bottom-left to top-right, dots sit on a 3 × 3 grid", () => {
    // Along a stripe u + v is constant.
    const on = [...Array(PATTERN_SIZE).keys()].filter((x) =>
      patternMask("stripes", x, PATTERN_SIZE - 1 - x),
    );
    expect(on.length === 0 || on.length === PATTERN_SIZE).toBe(true);
    expect(patternMask("dots", PATTERN_SIZE / 2, PATTERN_SIZE / 2)).toBe(true);
    expect(patternMask("dots", PATTERN_SIZE / 3, PATTERN_SIZE / 2)).toBe(false);
  });

  it("makes one cached texture per pattern", () => {
    expect(patternTexture("dots")).toBe(patternTexture("dots"));
    expect(patternTexture("dots").image.width).toBe(PATTERN_SIZE);
  });
});

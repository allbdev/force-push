/**
 * Floor patterns (GAME_PLAN.md §10, canvas page "Floor patterns"): colour never carries meaning
 * alone, and hotfix and dev look alike under deuteranopia, so each branch's tiles carry a pattern.
 */
import type { Branch } from "./branches";

export type FloorPattern = "solid" | "stripes" | "dots" | "lines";

export const FLOOR_PATTERNS: Readonly<Record<Branch, FloorPattern>> = {
  main: "solid",
  feature: "stripes",
  hotfix: "dots",
  dev: "lines",
};

/** How much darker the pattern is than the tile. */
export const PATTERN_DARKEN = 0.18;

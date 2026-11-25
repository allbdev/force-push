/** The four branches, in seat order, with their colours (GAME_PLAN.md §10, design tokens). */
export const BRANCHES = ["main", "feature", "hotfix", "dev"] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_COLOURS: Readonly<Record<Branch, string>> = {
  main: "#3f8cff",
  feature: "#ff9a1f",
  hotfix: "#ff4f93",
  dev: "#19c3a6",
};

/** Text on any branch colour. */
export const ON_BRANCH = "#0d0e12";

/** An unpainted floor tile (nobody's). */
export const FLOOR_GREY = "#8c919c";

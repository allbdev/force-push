/** Power-ups (GAME_PLAN.md §6.4). Their names live in the locale files under `powerUps.<kind>`. */
export const POWER_UPS = ["coffee", "duck", "stackOverflow", "secondMonitor", "rebase"] as const;
export type PowerUp = (typeof POWER_UPS)[number];

/** Stored in the grid as 1 + index; 0 means none. */
export function powerUpCode(kind: PowerUp): number {
  return POWER_UPS.indexOf(kind) + 1;
}

export function powerUpFromCode(code: number): PowerUp | null {
  return POWER_UPS[code - 1] ?? null;
}

/** The ring colour on each power-up's plate (board "Items and blocks"). */
export const POWER_UP_RING: Readonly<Record<PowerUp, string>> = {
  coffee: "#c8843c",
  duck: "#ffd23f",
  stackOverflow: "#f48024",
  secondMonitor: "#58a6ff",
  rebase: "#a371f7",
};

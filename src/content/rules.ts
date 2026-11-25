/**
 * The rules' numbers (GAME_PLAN.md §6), in ticks at 20 per second. First drafts: tune from
 * playtests (roadmap task 57). The simulation reads them from here, never hardcodes them.
 */
export const TICKS_PER_SECOND = 20;

export const RULES = {
  /** Ticks to walk one tile, and with coffee. */
  stepTicks: 5,
  coffeeStepTicks: 4,
  coffeeTicks: 10 * TICKS_PER_SECOND,
  /** Force-push. */
  fuseTicks: 3 * TICKS_PER_SECOND,
  blastTicks: TICKS_PER_SECOND / 2,
  startRange: 2,
  maxRange: 6,
  startCarry: 2,
  maxCarry: 4,
  /** Reverted: out for 4 s (1 s falling), then 1 s of grace; 3 penalty tiles. */
  revertTicks: 4 * TICKS_PER_SECOND,
  fallTicks: TICKS_PER_SECOND,
  graceTicks: TICKS_PER_SECOND,
  penaltyTiles: 3,
  /** Code freeze (second version): last 30 s, one ring tile every 15 ticks. */
  freezeTicks: 30 * TICKS_PER_SECOND,
  freezeEveryTicks: 15,
  /** Sprint lengths offered in the lobby, in minutes; the default is the middle one. */
  sprintMinutes: [2, 3, 5] as const,
  defaultSprintMinutes: 3,
} as const;

export type Rules = typeof RULES;

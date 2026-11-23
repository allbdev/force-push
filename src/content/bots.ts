/** Bot weights (GAME_PLAN.md §6.7): what a bot values when choosing where to go and push. */
export type BotWeights = {
  /** Per box a push would break. */
  readonly box: number;
  /** Per grey tile, and per rival tile, a push would paint. */
  readonly grey: number;
  readonly rival: number;
  /** Per rival standing in the cross. */
  readonly player: number;
  readonly powerUp: number;
  /** Cost per step of walking there. */
  readonly distance: number;
  /** Random spread so bots don't all make the same choice. */
  readonly noise: number;
  /** A push worth less than this isn't dropped. */
  readonly minValue: number;
};

export const BOT: BotWeights = {
  box: 4,
  grey: 1,
  rival: 1.5,
  player: 3,
  powerUp: 6,
  distance: 0.9,
  noise: 1.5,
  minValue: 3,
};

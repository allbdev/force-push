/**
 * What the share line says (GAME_PLAN.md §9), built from the result; the words are added at the
 * edge (src/ui/format.ts) so the line can be read in either locale.
 *   line 1: the game and the room · line 2: the winner's diff · line 3: the sharer's own match.
 */
import type { MatchResult } from "./score";
import type { GameState } from "./state";

export type ShareData = {
  readonly code: string;
  /** Winning seats (more than one on a tie) and the first winner's diff. */
  readonly winners: readonly number[];
  readonly plus: number;
  readonly minus: number;
  readonly share: number;
  /** The sharer's pushes and how often they were reverted (-1 seat: a spectator, totals). */
  readonly pushes: number;
  readonly reverts: number;
};

export function shareData(
  result: MatchResult,
  state: Pick<GameState, "stats">,
  code: string,
  seat: number,
): ShareData {
  const top = result.rows.find((r) => r.seat === result.winners[0])!;
  const mine = seat >= 0 && seat < state.stats.pushes.length;
  return {
    code,
    winners: result.winners,
    plus: top.plus,
    minus: top.minus,
    share: top.share,
    pushes: mine ? state.stats.pushes[seat]! : result.pushes,
    reverts: mine ? state.stats.reverted[seat]! : result.reverts,
  };
}

/**
 * One tick of a match: `step(state, inputs) → state`, pure and deterministic. `inputs` holds five
 * bits per seat (src/core/state.ts). `stepInPlace` is the same without the copy, for hot loops.
 */
import { movePlayer, updatePref } from "./movement";
import { cloneState, INPUT_MASK, inPlay, SEATS, type GameState } from "./state";

export function step(state: GameState, inputs: readonly number[]): GameState {
  const next = cloneState(state);
  stepInPlace(next, inputs);
  return next;
}

export function stepInPlace(s: GameState, inputs: readonly number[]): void {
  s.events = [];
  if (s.ended) return;

  for (let seat = 0; seat < SEATS; seat++) {
    const p = s.players[seat]!;
    const input = (inputs[seat] ?? 0) & INPUT_MASK;
    updatePref(p, input);
    if (inPlay(p)) {
      movePlayer(s, seat, input);
    }
    p.prevInput = input;
  }

  s.tick += 1;
  if (s.tick >= s.endTick) {
    s.ended = true;
    s.events.push({ type: "end" });
  }
}

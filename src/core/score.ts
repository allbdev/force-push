/**
 * The result: the diff per branch (GAME_PLAN.md §6.5). `+` minus `−` is exactly the tiles a
 * branch owns. Shares are of the painted tiles and add up to 100 (largest remainder).
 * Winner: most tiles; then the bigger `+`; still tied, they share the win.
 */
import { isOpen, SEATS, type GameState } from "./state";

export type BranchScore = {
  readonly seat: number;
  readonly owned: number;
  readonly plus: number;
  readonly minus: number;
  /** Whole percent of the painted tiles. */
  readonly share: number;
};

export type MatchResult = {
  /** Best first (by owned, then plus, then seat); closed seats are left out. */
  readonly rows: readonly BranchScore[];
  /** Seats that won (more than one on a full tie). */
  readonly winners: readonly number[];
  readonly painted: number;
  readonly pushes: number;
  readonly reverts: number;
  readonly boxes: number;
  readonly bestSeat: number;
  readonly bestGain: number;
  /** The most reverted seat and how often (-1 when nobody was). */
  readonly mostRevertedSeat: number;
  readonly mostReverted: number;
};

export function ownedTiles(s: Pick<GameState, "owner">, seat: number): number {
  let n = 0;
  for (const o of s.owner) if (o === seat + 1) n++;
  return n;
}

/**
 * Whole-number shares that add up to 100 (or all 0 when nothing is painted). Spare points go to
 * the largest remainders; on equal remainders, to the higher `rank` (so a tie on tiles never shows
 * the loser ahead of the winner).
 */
export function shares(counts: readonly number[], rank: readonly number[] = []): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const base = counts.map((c) => Math.floor((c * 100) / total));
  const rest = counts.map((c, i) => ({ i, r: (c * 100) % total }));
  rest.sort(
    (a, b) =>
      b.r - a.r || counts[b.i]! - counts[a.i]! || (rank[b.i] ?? 0) - (rank[a.i] ?? 0) || a.i - b.i,
  );
  let left = 100 - base.reduce((a, b) => a + b, 0);
  for (const { i } of rest) {
    if (left <= 0) break;
    base[i]! += 1;
    left--;
  }
  return base;
}

export function scoreMatch(s: GameState): MatchResult {
  const owned = Array.from({ length: SEATS }, (_, seat) => ownedTiles(s, seat));
  const open = owned.map((_, seat) => seat).filter((seat) => isOpen(s.players[seat]!));
  const pct = shares(
    open.map((seat) => owned[seat]!),
    open.map((seat) => s.plus[seat]!),
  );
  const rows: BranchScore[] = open.map((seat, k) => ({
    seat,
    owned: owned[seat]!,
    plus: s.plus[seat]!,
    minus: s.minus[seat]!,
    share: pct[k]!,
  }));
  rows.sort((a, b) => b.owned - a.owned || b.plus - a.plus || a.seat - b.seat);
  const top = rows[0]!;
  const winners = rows
    .filter((r) => r.owned === top.owned && r.plus === top.plus)
    .map((r) => r.seat);
  let mostRevertedSeat = -1;
  let mostReverted = 0;
  s.stats.reverted.forEach((n, seat) => {
    if (n > mostReverted) {
      mostReverted = n;
      mostRevertedSeat = seat;
    }
  });
  const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    rows,
    winners,
    painted: sum(owned),
    pushes: sum(s.stats.pushes),
    reverts: sum(s.stats.reverted),
    boxes: sum(s.stats.boxes),
    bestSeat: s.stats.bestSeat,
    bestGain: s.stats.bestGain,
    mostRevertedSeat,
    mostReverted,
  };
}

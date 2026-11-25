/**
 * Tile-to-tile movement (GAME_PLAN.md §5). A step takes `stepTicks` ticks. At each tile centre
 * the player takes the most recently pressed direction that is open; if that one is blocked,
 * another held one; else they stop. Mid-step, pressing the opposite way turns back.
 * Racks, boxes and frozen tiles block; so does a push, unless you were standing on it when it was
 * dropped and haven't left yet. Players walk through each other.
 */
import { DX, DY, FLOOR, type Dir } from "./map";
import { DIR_BITS, pushAt, stepTicks, type GameState, type Player } from "./state";

/** Remembers the most recently pressed direction (newly pressed this tick wins). */
export function updatePref(p: Player, input: number): void {
  const pressed = input & ~p.prevInput;
  for (let d = 0; d < 4; d++) {
    if (pressed & DIR_BITS[d]!) {
      p.pref = d as Dir;
      return;
    }
  }
  if (p.pref !== -1 && !(input & DIR_BITS[p.pref]!)) p.pref = -1;
}

/** Can `seat` move into tile (x, y)? */
export function canEnter(s: GameState, seat: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return false;
  const i = y * s.width + x;
  if (s.kind[i] !== FLOOR) return false;
  const push = pushAt(s, i);
  return !push || (push.pass & (1 << seat)) !== 0;
}

/** Held directions in the order the corner rule tries them: the preferred one first. */
function candidates(p: Player, input: number): Dir[] {
  const out: Dir[] = [];
  if (p.pref !== -1 && input & DIR_BITS[p.pref]!) out.push(p.pref);
  for (let d = 0; d < 4; d++) if (d !== p.pref && input & DIR_BITS[d]!) out.push(d as Dir);
  return out;
}

/** Advances one player one tick. `input` has already updated `pref`. */
export function movePlayer(s: GameState, seat: number, input: number): void {
  const p = s.players[seat]!;
  const ticks = stepTicks(p);

  if (p.dir !== -1 && p.progress > 0) {
    const back = ((p.dir + 2) % 4) as Dir;
    const wantsBack =
      (input & DIR_BITS[back]!) !== 0 && (p.pref === back || (input & DIR_BITS[p.dir]!) === 0);
    // Turning back heads for the tile we left, which must still be enterable (a push dropped
    // there after we left blocks it; one dropped while we stood on it lets us through).
    if (wantsBack && canEnter(s, seat, p.x, p.y)) {
      p.x += DX[p.dir]!;
      p.y += DY[p.dir]!;
      p.dir = back;
      p.facing = back;
      p.progress = Math.max(0, ticks - p.progress);
    }
    p.progress += 1;
    if (p.progress >= ticks) arrive(p);
    return;
  }

  const options = candidates(p, input);
  for (const d of options) {
    if (canEnter(s, seat, p.x + DX[d]!, p.y + DY[d]!)) {
      p.dir = d;
      p.facing = d;
      p.progress = 1;
      if (p.progress >= ticks) arrive(p);
      return;
    }
  }
  p.dir = -1;
  p.progress = 0;
  if (options.length > 0) p.facing = options[0]!;
}

function arrive(p: Player): void {
  if (p.dir === -1) return;
  p.x += DX[p.dir]!;
  p.y += DY[p.dir]!;
  p.progress = 0;
}

/** Stops a player who is heading into tile `i` but not yet on it (a push just landed there). */
export function bounceFrom(s: GameState, seat: number, i: number): void {
  const p = s.players[seat]!;
  if (p.dir === -1 || p.progress === 0) return;
  const tx = p.x + DX[p.dir]!;
  const ty = p.y + DY[p.dir]!;
  if (ty * s.width + tx === i && p.progress * 2 < stepTicks(p)) {
    p.dir = -1;
    p.progress = 0;
  }
}

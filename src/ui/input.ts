/**
 * Keys and touches turned into the five input bits (GAME_PLAN.md §5). Sampled once per tick.
 * The quantising maths is pure so it can be tested; the listeners are thin.
 */
import { IN_DOWN, IN_LEFT, IN_PUSH, IN_RIGHT, IN_UP } from "../core/state";

const KEY_BITS: Readonly<Record<string, number>> = {
  KeyW: IN_UP,
  ArrowUp: IN_UP,
  KeyD: IN_RIGHT,
  ArrowRight: IN_RIGHT,
  KeyS: IN_DOWN,
  ArrowDown: IN_DOWN,
  KeyA: IN_LEFT,
  ArrowLeft: IN_LEFT,
  Space: IN_PUSH,
};

export function keyBit(code: string): number {
  return KEY_BITS[code] ?? 0;
}

/** The stick: four directions with a dead zone (a fraction of the stick's radius). */
export const DEAD_ZONE = 0.28;

export function stickBits(dx: number, dy: number, radius: number): number {
  const len = Math.hypot(dx, dy);
  if (radius <= 0 || len < radius * DEAD_ZONE) return 0;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? IN_RIGHT : IN_LEFT;
  return dy > 0 ? IN_DOWN : IN_UP;
}

/** Holds what's pressed; `sample()` returns this tick's bits. */
export class InputState {
  private keys = 0;
  private stick = 0;
  private touchPush = false;
  /** A push tapped and released between two samples still counts once. */
  private pushLatch = false;

  keyDown(code: string): boolean {
    const bit = keyBit(code);
    if (!bit) return false;
    this.keys |= bit;
    if (bit === IN_PUSH) this.pushLatch = true;
    return true;
  }

  keyUp(code: string): boolean {
    const bit = keyBit(code);
    if (!bit) return false;
    this.keys &= ~bit;
    return true;
  }

  setStick(bits: number): void {
    this.stick = bits;
  }

  setTouchPush(down: boolean): void {
    if (down && !this.touchPush) this.pushLatch = true;
    this.touchPush = down;
  }

  clear(): void {
    this.keys = 0;
    this.stick = 0;
    this.touchPush = false;
    this.pushLatch = false;
  }

  /**
   * This tick's bits. A latched tap is sent as pressed for one sample; the next sample shows the
   * release so the following press counts as a new one.
   */
  sample(): number {
    let bits = (this.keys | this.stick) & ~IN_PUSH;
    const held = (this.keys & IN_PUSH) !== 0 || this.touchPush;
    if (this.pushLatch) {
      bits |= IN_PUSH;
      this.pushLatch = false;
    } else if (held) {
      // Holding the button doesn't drop a push every tile: one press, one push.
      bits &= ~IN_PUSH;
    }
    return bits;
  }
}

/** Keyboard listeners on `target`; returns a function that removes them. */
export function bindKeyboard(target: Window, input: InputState, onMenu: () => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      onMenu();
      return;
    }
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    if (e.repeat && keyBit(e.code) === IN_PUSH) {
      e.preventDefault();
      return;
    }
    if (input.keyDown(e.code)) e.preventDefault();
  };
  const up = (e: KeyboardEvent) => {
    if (input.keyUp(e.code)) e.preventDefault();
  };
  const blur = () => input.clear();
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", blur);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", blur);
  };
}

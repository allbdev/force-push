/**
 * Seeded randomness for the simulation: integers only, identical in every engine.
 * `Rng` is a small mutable generator (sfc32) for building a match; `hash32` gives stateless,
 * reproducible numbers from a few integers (bots use it so they never carry hidden state).
 */

/** 32-bit integer mix (lowbias32 by Chris Wellons). */
export function mix32(x: number): number {
  x = x >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** A reproducible unsigned 32-bit number from any number of integers. */
export function hash32(...values: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const v of values) h = mix32(h ^ mix32(v | 0));
  return h;
}

export type RngState = [number, number, number, number];

export function seedRng(seed: number): RngState {
  const s: RngState = [mix32(seed), mix32(seed ^ 0x51ed270b), mix32(seed ^ 0x2545f491), 1];
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}

/** sfc32: advances the state in place and returns an unsigned 32-bit integer. */
export function nextU32(s: RngState): number {
  const t = (((s[0] + s[1]) | 0) + s[3]) | 0;
  s[3] = (s[3] + 1) | 0;
  s[0] = s[1] ^ (s[1] >>> 9);
  s[1] = (s[2] + (s[2] << 3)) | 0;
  s[2] = (s[2] << 21) | (s[2] >>> 11);
  s[2] = (s[2] + t) | 0;
  return t >>> 0;
}

/** An integer in [0, n), without modulo bias. `n` must be in [1, 2^32]. */
export function nextInt(s: RngState, n: number): number {
  if (n <= 1) return 0;
  const limit = 0x100000000 - (0x100000000 % n);
  for (;;) {
    const x = nextU32(s);
    if (x < limit) return x % n;
  }
}

/** Fisher–Yates shuffle in place. */
export function shuffle<T>(s: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(s, i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Picks a key with probability proportional to its integer weight. */
export function pickWeighted<K extends string>(
  s: RngState,
  weights: Readonly<Record<K, number>>,
): K {
  const keys = (Object.keys(weights) as K[]).filter((k) => weights[k] > 0).sort();
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let r = nextInt(s, total);
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1]!;
}

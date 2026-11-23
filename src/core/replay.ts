/**
 * Replays (GAME_PLAN.md §9): a match is its seed, map, version and inputs, so a replay is a short
 * string that runs `step` again. Inputs are packed four seats to 20 bits and run-length encoded,
 * then base64url'd for a link. Decoding is strict: anything malformed, too long or from another
 * version is refused politely (null).
 */
import { mapById } from "../content/maps";
import { createMatch, SEATS, SIM_VERSION, type GameState } from "./state";
import { stepInPlace } from "./step";

const FORMAT = 1;
/** Longest replay accepted: a 5-minute sprint with every tick different (generous). */
export const MAX_REPLAY_TICKS = 5 * 60 * 20;
export const MAX_REPLAY_CHARS = 48_000;

export type Replay = {
  readonly version: number;
  readonly seed: number;
  readonly mapId: string;
  /** The sprint length, and whether the code freeze was on. */
  readonly ticks: number;
  readonly freeze: boolean;
  /** Four bytes (one per seat) per recorded tick. */
  readonly inputs: Uint8Array;
};

function pack(inputs: Uint8Array, t: number): number {
  let v = 0;
  for (let s = 0; s < SEATS; s++) v |= (inputs[t * SEATS + s]! & 31) << (5 * s);
  return v;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2;
    for (let c = 0; c < chars; c++) out += B64[(n >> (18 - 6 * c)) & 63];
  }
  return out;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (text.length > MAX_REPLAY_CHARS || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1)
    return null;
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let c = 0; c < 4; c++) n = (n << 6) | (c < chunk.length ? B64.indexOf(chunk[c]!) : 0);
    out.push((n >> 16) & 255);
    if (chunk.length > 2) out.push((n >> 8) & 255);
    if (chunk.length > 3) out.push(n & 255);
  }
  return Uint8Array.from(out);
}

export function encodeReplay(r: Replay): string {
  const n = r.inputs.length / SEATS;
  const bytes: number[] = [FORMAT, r.version & 255];
  const u32 = (v: number) =>
    bytes.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const u16 = (v: number) => bytes.push((v >>> 8) & 255, v & 255);
  u32(r.seed >>> 0);
  u16(r.ticks);
  bytes.push(r.freeze ? 1 : 0, r.mapId.length);
  for (const ch of r.mapId) bytes.push(ch.charCodeAt(0));
  u16(n);
  for (let t = 0; t < n;) {
    const v = pack(r.inputs, t);
    let run = 1;
    while (t + run < n && pack(r.inputs, t + run) === v) run++;
    // Run length as a varint, then the 20-bit value in 3 bytes.
    let len = run;
    while (len >= 128) {
      bytes.push((len & 127) | 128);
      len >>>= 7;
    }
    bytes.push(len, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
    t += run;
  }
  return toBase64Url(bytes);
}

export function decodeReplay(text: unknown): Replay | null {
  if (typeof text !== "string") return null;
  const b = fromBase64Url(text);
  if (!b || b.length < 13) return null;
  let i = 0;
  const u8 = () => (i < b.length ? b[i++]! : -1);
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) | (u8() << 16) | (u8() << 8) | u8()) >>> 0;
  if (u8() !== FORMAT) return null;
  const version = u8();
  if (version !== SIM_VERSION) return null;
  const seed = u32() | 0;
  const ticks = u16();
  const flags = u8();
  const idLen = u8();
  if (ticks < 1 || ticks > MAX_REPLAY_TICKS || flags > 1 || idLen < 1 || idLen > 32) return null;
  let mapId = "";
  for (let k = 0; k < idLen; k++) {
    const c = u8();
    if (c < 0) return null;
    mapId += String.fromCharCode(c);
  }
  if (!/^[a-z0-9-]+$/.test(mapId) || !mapById(mapId)) return null;
  const n = u16();
  if (n < 0 || n > ticks) return null;
  const inputs = new Uint8Array(n * SEATS);
  let t = 0;
  while (t < n) {
    let run = 0;
    let shift = 0;
    for (;;) {
      const x = u8();
      if (x < 0 || shift > 14) return null;
      run |= (x & 127) << shift;
      shift += 7;
      if (!(x & 128)) break;
    }
    const v = (u8() << 16) | (u8() << 8) | u8();
    if (v < 0 || v >= 1 << 20 || run < 1 || t + run > n) return null;
    for (let k = 0; k < run; k++, t++)
      for (let s = 0; s < SEATS; s++) inputs[t * SEATS + s] = (v >> (5 * s)) & 31;
  }
  if (i !== b.length) return null;
  return { version, seed, mapId, ticks, freeze: flags === 1, inputs };
}

/** The state after the first `upTo` recorded ticks (all of them by default). */
export function replayState(r: Replay, upTo = r.inputs.length / SEATS): GameState {
  const s = createMatch({ map: mapById(r.mapId)!, seed: r.seed, ticks: r.ticks, freeze: r.freeze });
  const inputs = [0, 0, 0, 0];
  const n = Math.min(upTo, r.inputs.length / SEATS);
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < SEATS; k++) inputs[k] = r.inputs[t * SEATS + k]!;
    stepInPlace(s, inputs);
  }
  return s;
}

/** The tick (index into the inputs) on which the match's biggest blast went off, or -1. */
export function biggestPushTick(r: Replay): number {
  const s = createMatch({ map: mapById(r.mapId)!, seed: r.seed, ticks: r.ticks, freeze: r.freeze });
  const inputs = [0, 0, 0, 0];
  let best = -1;
  let gain = 0;
  for (let t = 0; t < r.inputs.length / SEATS; t++) {
    for (let k = 0; k < SEATS; k++) inputs[k] = r.inputs[t * SEATS + k]!;
    stepInPlace(s, inputs);
    for (const e of s.events)
      if (e.type === "blast" && e.gained > gain) {
        gain = e.gained;
        best = t;
      }
  }
  return best;
}

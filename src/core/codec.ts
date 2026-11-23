/**
 * The wire format (GAME_PLAN.md §11). Everything read from a socket is untrusted: a size cap,
 * strict parsing, and anything unexpected is rejected (null), never guessed at.
 *
 * Hot messages are binary: an input is 6 bytes, a tick 25 bytes for four seats (about 6 bytes a
 * player). Everything else is JSON with every field checked.
 */
import { BRANCHES } from "../content/branches";
import type {
  ClientMessage,
  LobbyView,
  MatchStart,
  RoomPhase,
  SeatKind,
  ServerMessage,
} from "./protocol";
import { SEATS, type GameState, type Player, type Push } from "./state";

/** Largest message a client may send, and the largest a server sends (a snapshot). */
export const MAX_CLIENT_BYTES = 256;
export const MAX_SERVER_BYTES = 64 * 1024;

const BIN_INPUT = 1;
const BIN_TICK = 2;
const BIN_HASH = 3;

type Json = Record<string, unknown>;

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}
function isStr(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max;
}
function onlyKeys(o: Json, keys: readonly string[]): boolean {
  return Object.keys(o).every((k) => keys.includes(k));
}
function parseJson(text: string, max: number): unknown {
  if (text.length > max) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

// ----- client → server -------------------------------------------------------------------------

export function encodeClient(m: ClientMessage): string | Uint8Array<ArrayBuffer> {
  if (m.t === "input") {
    const b = new Uint8Array(6);
    const v = new DataView(b.buffer);
    v.setUint8(0, BIN_INPUT);
    v.setUint32(1, m.seq >>> 0);
    v.setUint8(5, m.bits & 31);
    return b;
  }
  return JSON.stringify(m);
}

export function decodeClient(data: string | ArrayBuffer | Uint8Array): ClientMessage | null {
  if (typeof data !== "string") {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength !== 6 || bytes[0] !== BIN_INPUT) return null;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const bits = v.getUint8(5);
    if (bits > 31) return null;
    return { t: "input", seq: v.getUint32(1), bits };
  }
  const o = parseJson(data, MAX_CLIENT_BYTES);
  if (!isObj(o) || typeof o.t !== "string") return null;
  switch (o.t) {
    case "join":
      if (!onlyKeys(o, ["t", "name", "token"])) return null;
      if (!isStr(o.name, 48) || !isStr(o.token, 64) || !/^[a-z0-9]*$/.test(o.token)) return null;
      return { t: "join", name: o.name, token: o.token };
    case "ready":
      if (!onlyKeys(o, ["t", "ready"]) || typeof o.ready !== "boolean") return null;
      return { t: "ready", ready: o.ready };
    case "settings":
      if (!onlyKeys(o, ["t", "mapId", "minutes"])) return null;
      if (!isStr(o.mapId, 32) || !/^[a-z0-9-]+$/.test(o.mapId) || !isInt(o.minutes, 1, 10))
        return null;
      return { t: "settings", mapId: o.mapId, minutes: o.minutes };
    case "seat":
      if (!onlyKeys(o, ["t", "seat", "closed"])) return null;
      if (!isInt(o.seat, 0, SEATS - 1) || typeof o.closed !== "boolean") return null;
      return { t: "seat", seat: o.seat, closed: o.closed };
    case "ping":
      if (!onlyKeys(o, ["t", "id"]) || !isInt(o.id, 0, 0xffffffff)) return null;
      return { t: "ping", id: o.id };
    case "start":
    case "rematch":
    case "lobby":
    case "leave":
    case "sync":
      if (!onlyKeys(o, ["t"])) return null;
      return { t: o.t };
    default:
      return null;
  }
}

// ----- server → client -------------------------------------------------------------------------

export function encodeServer(m: ServerMessage): string | Uint8Array<ArrayBuffer> {
  if (m.t === "tick") {
    const b = new Uint8Array(1 + 4 + SEATS + 4 * SEATS);
    const v = new DataView(b.buffer);
    v.setUint8(0, BIN_TICK);
    v.setUint32(1, m.tick >>> 0);
    for (let k = 0; k < SEATS; k++) {
      v.setUint8(5 + k, (m.inputs[k] ?? 0) & 31);
      v.setUint32(5 + SEATS + 4 * k, (m.acks[k] ?? 0) >>> 0);
    }
    return b;
  }
  if (m.t === "hash") {
    const b = new Uint8Array(9);
    const v = new DataView(b.buffer);
    v.setUint8(0, BIN_HASH);
    v.setUint32(1, m.tick >>> 0);
    v.setUint32(5, m.hash >>> 0);
    return b;
  }
  if (m.t === "snapshot")
    return JSON.stringify({ t: "snapshot", match: m.match, state: stateToJson(m.state) });
  return JSON.stringify(m);
}

export function decodeServer(data: string | ArrayBuffer | Uint8Array): ServerMessage | null {
  if (typeof data !== "string") {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[0] === BIN_TICK && bytes.byteLength === 1 + 4 + SEATS + 4 * SEATS) {
      const inputs: number[] = [];
      const acks: number[] = [];
      for (let k = 0; k < SEATS; k++) {
        const bits = v.getUint8(5 + k);
        if (bits > 31) return null;
        inputs.push(bits);
        acks.push(v.getUint32(5 + SEATS + 4 * k));
      }
      return { t: "tick", tick: v.getUint32(1), inputs, acks };
    }
    if (bytes[0] === BIN_HASH && bytes.byteLength === 9)
      return { t: "hash", tick: v.getUint32(1), hash: v.getUint32(5) };
    return null;
  }
  const o = parseJson(data, MAX_SERVER_BYTES);
  if (!isObj(o) || typeof o.t !== "string") return null;
  switch (o.t) {
    case "welcome":
      if (!isInt(o.seat, -1, SEATS - 1) || !isStr(o.token, 64) || !/^[a-z0-9]*$/.test(o.token))
        return null;
      return { t: "welcome", seat: o.seat, token: o.token };
    case "lobby": {
      const lobby = parseLobby(o.lobby);
      return lobby ? { t: "lobby", lobby } : null;
    }
    case "start": {
      const match = parseMatch(o.match);
      return match ? { t: "start", match } : null;
    }
    case "snapshot": {
      const match = parseMatch(o.match);
      const state = match ? stateFromJson(o.state) : null;
      return match && state ? { t: "snapshot", match, state } : null;
    }
    case "pong":
      return isInt(o.id, 0, 0xffffffff) ? { t: "pong", id: o.id } : null;
    case "error": {
      const codes = ["full", "bad-message", "not-host", "rate", "closed", "version"] as const;
      const code = codes.find((c) => c === o.code);
      return code ? { t: "error", code } : null;
    }
    default:
      return null;
  }
}

const PHASES: readonly RoomPhase[] = ["lobby", "playing", "result"];
const KINDS: readonly SeatKind[] = ["empty", "human", "bot", "closed"];

function parseLobby(v: unknown): LobbyView | null {
  if (!isObj(v)) return null;
  const { code, phase, seats, host, mapId, minutes, rematch } = v;
  if (!isStr(code, 16) || !/^[A-Z]{3,5}-?\d{0,4}$/.test(code)) return null;
  const ph = PHASES.find((p) => p === phase);
  if (!ph || !Array.isArray(seats) || seats.length !== SEATS) return null;
  if (!isInt(host, 0, SEATS - 1) || !isStr(mapId, 32) || !isInt(minutes, 1, 10)) return null;
  if (
    !Array.isArray(rematch) ||
    rematch.length !== SEATS ||
    !rematch.every((r) => typeof r === "boolean")
  )
    return null;
  const out = [];
  for (const s of seats) {
    if (!isObj(s)) return null;
    const kind = KINDS.find((k) => k === s.kind);
    if (!kind || !isStr(s.name, 48) || typeof s.ready !== "boolean" || typeof s.away !== "boolean")
      return null;
    out.push({ kind, name: s.name, ready: s.ready, away: s.away });
  }
  return { code, phase: ph, seats: out, host, mapId, minutes, rematch: rematch as boolean[] };
}

function parseMatch(v: unknown): MatchStart | null {
  if (!isObj(v)) return null;
  const { seed, mapId, ticks, freeze, closed, version } = v;
  if (!isInt(seed, -0x80000000, 0xffffffff) || !isStr(mapId, 32) || !isInt(ticks, 1, 20 * 60 * 10))
    return null;
  if (typeof freeze !== "boolean" || !isInt(closed, 0, 14) || !isInt(version, 0, 1000)) return null;
  return { seed, mapId, ticks, freeze, closed, version };
}

// ----- snapshots -------------------------------------------------------------------------------

const PLAYER_KEYS: readonly (keyof Player)[] = [
  "x",
  "y",
  "dir",
  "progress",
  "facing",
  "pref",
  "prevInput",
  "range",
  "carry",
  "coffee",
  "duck",
  "rebase",
  "out",
  "grace",
  "fellX",
  "fellY",
  "revertedBy",
];
const PUSH_KEYS: readonly (keyof Push)[] = [
  "id",
  "owner",
  "x",
  "y",
  "fuse",
  "age",
  "range",
  "rebase",
  "pass",
];
const GRIDS = ["kind", "hidden", "item", "owner", "blast", "blastSeat"] as const;

export function stateToJson(s: GameState): Json {
  return {
    ...s,
    ...Object.fromEntries(GRIDS.map((k) => [k, Array.from(s[k])])),
    events: [],
  };
}

function intArray(v: unknown, length: number, max: number): number[] | null {
  if (!Array.isArray(v) || v.length !== length) return null;
  return v.every((x) => isInt(x, -1, max)) ? (v as number[]) : null;
}

/** A snapshot from the server, checked field by field. */
export function stateFromJson(v: unknown): GameState | null {
  if (!isObj(v)) return null;
  const w = v.width;
  const h = v.height;
  if (!isInt(w, 5, 31) || !isInt(h, 5, 31)) return null;
  const n = w * h;
  const grids: Partial<Record<(typeof GRIDS)[number], Uint8Array>> = {};
  for (const k of GRIDS) {
    const arr = intArray(v[k], n, 255);
    if (!arr || arr.some((x) => x < 0)) return null;
    grids[k] = Uint8Array.from(arr);
  }
  if (!Array.isArray(v.players) || v.players.length !== SEATS) return null;
  const players: Player[] = [];
  for (const p of v.players) {
    if (!isObj(p)) return null;
    const out: Record<string, number> = {};
    for (const k of PLAYER_KEYS) {
      if (!isInt(p[k], -1, 0xffff)) return null;
      out[k] = p[k];
    }
    players.push(out as unknown as Player);
  }
  if (!Array.isArray(v.pushes) || v.pushes.length > 64) return null;
  const pushes: Push[] = [];
  for (const q of v.pushes) {
    if (!isObj(q)) return null;
    const out: Record<string, number> = {};
    for (const k of PUSH_KEYS) {
      if (!isInt(q[k], -1, 0x7fffffff)) return null;
      out[k] = q[k];
    }
    pushes.push(out as unknown as Push);
  }
  const ints = ["version", "seed", "tick", "endTick", "nextPushId", "frozen"] as const;
  for (const k of ints) if (!isInt(v[k], -0x80000000, 0xffffffff)) return null;
  const four = (x: unknown) => intArray(x, SEATS, 0xffff);
  const plus = four(v.plus);
  const minus = four(v.minus);
  const stats = v.stats;
  if (!plus || !minus || !isObj(stats)) return null;
  const sp = four(stats.pushes);
  const sr = four(stats.reverted);
  const sb = four(stats.boxes);
  if (
    !sp ||
    !sr ||
    !sb ||
    !isInt(stats.bestSeat, -1, SEATS - 1) ||
    !isInt(stats.bestGain, 0, 0xffff)
  )
    return null;
  const desks = intArray(v.desks, SEATS, n - 1);
  if (
    !desks ||
    typeof v.ended !== "boolean" ||
    typeof v.freeze !== "boolean" ||
    !isStr(v.mapId, 32)
  )
    return null;
  let wind: GameState["wind"] = null;
  if (v.wind !== null) {
    if (!isObj(v.wind) || !isInt(v.wind.dir, 0, 3) || !isInt(v.wind.delay, 1, 200)) return null;
    wind = { dir: v.wind.dir as 0 | 1 | 2 | 3, delay: v.wind.delay };
  }
  return {
    version: v.version as number,
    mapId: v.mapId,
    seed: v.seed as number,
    width: w,
    height: h,
    freeze: v.freeze,
    desks,
    wind,
    tick: v.tick as number,
    endTick: v.endTick as number,
    ended: v.ended,
    kind: grids.kind!,
    hidden: grids.hidden!,
    item: grids.item!,
    owner: grids.owner!,
    blast: grids.blast!,
    blastSeat: grids.blastSeat!,
    players,
    pushes,
    nextPushId: v.nextPushId as number,
    plus,
    minus,
    frozen: v.frozen as number,
    stats: {
      pushes: sp,
      reverted: sr,
      boxes: sb,
      bestSeat: stats.bestSeat,
      bestGain: stats.bestGain,
    },
    events: [],
  };
}

/** Branch names, re-exported for hosts that log seats. */
export const CODEC_BRANCHES = BRANCHES;

/**
 * A room (GAME_PLAN.md §7, §11): four seats, the lobby, the match and the result. It knows nothing
 * about sockets or clocks: a host feeds it messages (`receive`), calls `advance` 20 times a second
 * and delivers what it sends through a `RoomTransport`. The same class runs in the browser (local
 * transport, bots only) and on the server.
 *
 * Messages arriving here are already parsed and shape-checked by the codec; the room still checks
 * that each is allowed (seat, phase, host) and ignores the rest.
 */
import { BRANCHES } from "../content/branches";
import { DEFAULT_MAP_ID, mapById } from "../content/maps";
import { RULES, TICKS_PER_SECOND } from "../content/rules";
import { botInput } from "./bot";
import { cleanName } from "./names";
import type {
  ClientMessage,
  LobbyView,
  MatchStart,
  RoomPhase,
  SeatKind,
  ServerMessage,
} from "./protocol";
import {
  createMatch,
  hashState,
  IN_PUSH,
  INPUT_MASK,
  SEATS,
  SIM_VERSION,
  type GameState,
} from "./state";
import { stepInPlace } from "./step";

export interface RoomTransport {
  send(clientId: string, message: ServerMessage): void;
}

export type RoomOptions = {
  readonly code: string;
  readonly transport: RoomTransport;
  /** Random unsigned 32-bit integers (seeds and rejoin tokens), supplied by the host. */
  readonly random: () => number;
};

type Seat = {
  kind: SeatKind;
  name: string;
  ready: boolean;
  clientId: string | null;
  token: string;
  /** Latest input and the last sequence number seen. */
  input: number;
  /** Push presses since the last tick, so a quick tap between two ticks isn't lost. */
  latch: number;
  seq: number;
  rematch: boolean;
};

/** A hash goes out every second so clients can detect drift. */
export const HASH_EVERY = TICKS_PER_SECOND;

function emptySeat(): Seat {
  return {
    kind: "empty",
    name: "",
    ready: false,
    clientId: null,
    token: "",
    input: 0,
    latch: 0,
    seq: 0,
    rematch: false,
  };
}

export class Room {
  readonly code: string;
  private readonly transport: RoomTransport;
  private readonly random: () => number;
  private readonly seats: Seat[] = Array.from({ length: SEATS }, emptySeat);
  private readonly watchers = new Set<string>();
  private phaseValue: RoomPhase = "lobby";
  private host = 0;
  private mapId = DEFAULT_MAP_ID;
  private minutes: number = RULES.defaultSprintMinutes;
  private game: GameState | null = null;
  private match: MatchStart | null = null;

  constructor(options: RoomOptions) {
    this.code = options.code;
    this.transport = options.transport;
    this.random = options.random;
  }

  get phase(): RoomPhase {
    return this.phaseValue;
  }

  /** The authoritative state (read-only for hosts and tests). */
  get state(): Readonly<GameState> | null {
    return this.game;
  }

  /** Humans currently connected; the host closes the room some time after this hits zero. */
  get connected(): number {
    return this.seats.filter((s) => s.clientId !== null).length + this.watchers.size;
  }

  seatOf(clientId: string): number {
    return this.seats.findIndex((s) => s.clientId === clientId);
  }

  receive(clientId: string, message: ClientMessage): void {
    const seat = this.seatOf(clientId);
    if (message.t === "join") {
      this.join(clientId, message.name, message.token);
      return;
    }
    if (message.t === "ping") {
      this.transport.send(clientId, { t: "pong", id: message.id });
      return;
    }
    if (seat < 0) return;
    const s = this.seats[seat]!;
    switch (message.t) {
      case "input":
        if (message.seq > s.seq) {
          s.seq = message.seq;
          s.input = message.bits & INPUT_MASK;
          s.latch |= message.bits & IN_PUSH;
        }
        return;
      case "ready":
        if (this.phaseValue !== "lobby") return;
        s.ready = message.ready;
        this.broadcastLobby();
        return;
      case "settings":
        if (seat !== this.host) return this.send(clientId, { t: "error", code: "not-host" });
        if (this.phaseValue === "playing") return;
        if (!mapById(message.mapId)) return;
        if (!(RULES.sprintMinutes as readonly number[]).includes(message.minutes)) return;
        this.mapId = message.mapId;
        this.minutes = message.minutes;
        this.broadcastLobby();
        return;
      case "start":
        if (seat !== this.host) return this.send(clientId, { t: "error", code: "not-host" });
        if (this.phaseValue !== "playing") this.startMatch();
        return;
      case "rematch":
        if (this.phaseValue !== "result") return;
        s.rematch = true;
        if (seat === this.host || this.humans().every((h) => h.rematch)) this.startMatch();
        else this.broadcastLobby();
        return;
      case "lobby":
        if (seat !== this.host) return this.send(clientId, { t: "error", code: "not-host" });
        if (this.phaseValue !== "result") return;
        this.phaseValue = "lobby";
        this.broadcastLobby();
        return;
      case "leave":
        this.vacate(seat, true);
        return;
      case "sync":
        if (this.game && this.match)
          this.send(clientId, { t: "snapshot", match: this.match, state: this.game });
        return;
    }
  }

  /** The connection closed: a bot holds the seat until the same player comes back. */
  disconnect(clientId: string): void {
    this.watchers.delete(clientId);
    const seat = this.seatOf(clientId);
    if (seat >= 0) this.vacate(seat, false);
  }

  /** One tick: everyone's inputs (bots for empty and away seats), then `step`. */
  advance(): void {
    const game = this.game;
    if (this.phaseValue !== "playing" || !game) return;
    const inputs = this.seats.map((s, seat) =>
      s.kind === "human" && s.clientId !== null
        ? (s.input | s.latch) & INPUT_MASK
        : botInput(game, seat),
    );
    for (const s of this.seats) s.latch = 0;
    const tick = game.tick;
    stepInPlace(game, inputs);
    this.broadcast({ t: "tick", tick, inputs, acks: this.seats.map((s) => s.seq) });
    if (game.tick % HASH_EVERY === 0)
      this.broadcast({ t: "hash", tick: game.tick, hash: hashState(game) });
    if (game.ended) {
      this.phaseValue = "result";
      for (const s of this.seats) {
        s.rematch = false;
        s.ready = false;
      }
      this.broadcastLobby();
    }
  }

  lobbyView(): LobbyView {
    return {
      code: this.code,
      phase: this.phaseValue,
      seats: this.seats.map((s) => ({
        kind: s.kind,
        name: s.name,
        ready: s.ready,
        away: s.kind === "human" && s.clientId === null,
      })),
      host: this.host,
      mapId: this.mapId,
      minutes: this.minutes,
      rematch: this.seats.map((s) => s.rematch),
    };
  }

  private humans(): Seat[] {
    return this.seats.filter((s) => s.kind === "human" && s.clientId !== null);
  }

  private join(clientId: string, rawName: string, token: string): void {
    if (this.seatOf(clientId) >= 0) return;
    // Coming back with the same token reclaims the seat a bot was holding.
    let seat = token ? this.seats.findIndex((s) => s.kind === "human" && s.token === token) : -1;
    if (seat >= 0 && this.seats[seat]!.clientId !== null) seat = -1;
    if (seat < 0) seat = this.seats.findIndex((s) => s.kind === "empty");
    if (seat < 0) seat = this.seats.findIndex((s) => s.kind === "bot");
    if (seat < 0) {
      // Full of people: watch instead (spectator).
      this.watchers.add(clientId);
      this.send(clientId, { t: "welcome", seat: -1, token: "" });
      this.send(clientId, { t: "lobby", lobby: this.lobbyView() });
      if (this.game && this.match)
        this.send(clientId, { t: "snapshot", match: this.match, state: this.game });
      return;
    }
    const s = this.seats[seat]!;
    const returning = s.kind === "human" && s.token === token && token !== "";
    s.kind = "human";
    s.clientId = clientId;
    s.name = cleanName(rawName) || (returning ? s.name : "");
    if (!returning) {
      s.token = this.newToken();
      s.ready = false;
      s.seq = 0;
      s.input = 0;
    }
    if (this.humans().length === 1 || this.seats[this.host]!.clientId === null) this.host = seat;
    this.send(clientId, { t: "welcome", seat, token: s.token });
    this.broadcastLobby();
    if (this.game && this.match && this.phaseValue !== "lobby")
      this.send(clientId, { t: "snapshot", match: this.match, state: this.game });
  }

  private vacate(seat: number, leaving: boolean): void {
    const s = this.seats[seat]!;
    s.clientId = null;
    s.input = 0;
    s.latch = 0;
    if (leaving || this.phaseValue === "lobby") {
      Object.assign(s, emptySeat(), {
        kind: this.game && this.phaseValue === "playing" ? "bot" : "empty",
      });
    }
    if (seat === this.host) {
      const next = this.seats.findIndex((x) => x.kind === "human" && x.clientId !== null);
      if (next >= 0) this.host = next;
    }
    this.broadcastLobby();
  }

  private startMatch(): void {
    const map = mapById(this.mapId) ?? mapById(DEFAULT_MAP_ID)!;
    const match: MatchStart = {
      seed: this.random() | 0,
      mapId: map.id,
      ticks: this.minutes * 60 * TICKS_PER_SECOND,
      freeze: true,
      version: SIM_VERSION,
    };
    this.match = match;
    this.game = createMatch({ map, seed: match.seed, ticks: match.ticks, freeze: match.freeze });
    for (const s of this.seats) {
      if (s.kind === "empty") s.kind = "bot";
      s.rematch = false;
      s.latch = 0;
    }
    this.phaseValue = "playing";
    this.broadcastLobby();
    this.broadcast({ t: "start", match });
  }

  private newToken(): string {
    let out = "";
    for (let k = 0; k < 4; k++) out += (this.random() >>> 0).toString(36).padStart(7, "0");
    return out;
  }

  private broadcastLobby(): void {
    this.broadcast({ t: "lobby", lobby: this.lobbyView() });
  }

  private broadcast(message: ServerMessage): void {
    for (const s of this.seats) if (s.clientId !== null) this.transport.send(s.clientId, message);
    for (const w of this.watchers) this.transport.send(w, message);
  }

  private send(clientId: string, message: ServerMessage): void {
    this.transport.send(clientId, message);
  }
}

/** The branch names in seat order, for hosts that log or label seats. */
export const SEAT_BRANCHES = BRANCHES;

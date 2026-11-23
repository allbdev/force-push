/**
 * The client side of a room (GAME_PLAN.md §11). It keeps the **confirmed** state (the server's
 * ticks, applied in order, so it always equals the server's state for that tick) and a
 * **predicted** state: the confirmed one re-run with this player's inputs that the server hasn't
 * acknowledged yet. Every local tick the prediction is rebuilt from the confirmed state, so a
 * wrong guess is corrected as soon as the server's inputs arrive (rollback and re-run).
 *
 * Others are drawn from the confirmed state; only your own player is predicted.
 */
import { mapById } from "../content/maps";
import type { ClientMessage, LobbyView, MatchStart, ServerMessage } from "../core/protocol";
import {
  cloneState,
  createMatch,
  hashState,
  IN_PUSH,
  INPUT_MASK,
  SEATS,
  type GameState,
} from "../core/state";
import { stepInPlace } from "../core/step";

type Pending = { readonly seq: number; readonly bits: number };

/** At most this many unacknowledged inputs are predicted (about 1.5 s at 20 ticks a second). */
export const MAX_PREDICT = 30;
/** Confirmed-state hashes kept for checking against the server's. */
const HASH_HISTORY = 64;

export class MatchClient {
  seat = -1;
  token = "";
  lobby: LobbyView | null = null;
  match: MatchStart | null = null;
  confirmed: GameState | null = null;
  predicted: GameState | null = null;
  /** The confirmed state one tick earlier (for interpolating others). */
  previous: GameState | null = null;
  /** Called with every message this client wants to send. */
  private readonly sendMessage: (message: ClientMessage) => void;
  private seq = 0;
  private pending: Pending[] = [];
  private lastInputs: number[] = new Array<number>(SEATS).fill(0);
  private hashes = new Map<number, number>();
  /** Times the hash check failed (each triggers a resync). */
  mismatches = 0;
  /** Events from confirmed ticks, oldest first, for the HUD (drained by the UI). */
  readonly events: GameState["events"][number][] = [];

  constructor(send: (message: ClientMessage) => void) {
    this.sendMessage = send;
  }

  send(message: ClientMessage): void {
    this.sendMessage(message);
  }

  join(name: string, token = ""): void {
    this.send({ t: "join", name, token });
  }

  receive(message: ServerMessage): void {
    switch (message.t) {
      case "welcome":
        this.seat = message.seat;
        this.token = message.token;
        return;
      case "lobby":
        this.lobby = message.lobby;
        return;
      case "start":
        this.begin(message.match, null);
        return;
      case "snapshot":
        this.begin(message.match, cloneState(message.state));
        return;
      case "tick":
        this.applyTick(message.tick, message.inputs, message.acks);
        return;
      case "hash":
        this.checkHash(message.tick, message.hash);
        return;
      case "pong":
      case "error":
        return;
    }
  }

  /**
   * One local tick: send this tick's input and rebuild the prediction. Returns the message sent
   * (or null when not playing).
   */
  tick(bits: number): ClientMessage | null {
    if (!this.confirmed || this.seat < 0 || this.confirmed.ended) {
      this.predicted = this.confirmed;
      return null;
    }
    const message: ClientMessage = { t: "input", seq: ++this.seq, bits: bits & INPUT_MASK };
    this.pending.push({ seq: message.seq, bits: message.bits });
    if (this.pending.length > MAX_PREDICT) this.pending.shift();
    this.send(message);
    this.repredict();
    return message;
  }

  private begin(match: MatchStart, state: GameState | null): void {
    const map = mapById(match.mapId);
    if (!map) return;
    this.match = match;
    this.confirmed =
      state ?? createMatch({ map, seed: match.seed, ticks: match.ticks, freeze: match.freeze });
    this.previous = cloneState(this.confirmed);
    this.pending = [];
    this.hashes.clear();
    this.lastInputs.fill(0);
    this.events.length = 0;
    this.repredict();
  }

  private applyTick(tick: number, inputs: readonly number[], acks: readonly number[]): void {
    const s = this.confirmed;
    if (!s || tick !== s.tick) {
      // Out of step (missed a tick): ask for a fresh snapshot.
      if (s && tick > s.tick) this.send({ t: "sync" });
      return;
    }
    this.previous = cloneState(s);
    stepInPlace(s, inputs);
    for (const e of s.events) this.events.push(e);
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    this.lastInputs = inputs.slice(0, SEATS);
    this.hashes.set(s.tick, hashState(s));
    if (this.hashes.size > HASH_HISTORY) this.hashes.delete(this.hashes.keys().next().value!);
    const ack = this.seat >= 0 ? (acks[this.seat] ?? 0) : 0;
    this.pending = this.pending.filter((p) => p.seq > ack);
    this.repredict();
  }

  private checkHash(tick: number, hash: number): void {
    const mine = this.hashes.get(tick);
    if (mine !== undefined && mine !== hash) {
      this.mismatches++;
      this.send({ t: "sync" });
    }
  }

  /** Predicted = confirmed + my unacknowledged inputs; others repeat what they last did. */
  private repredict(): void {
    const s = this.confirmed;
    if (!s) {
      this.predicted = null;
      return;
    }
    if (this.pending.length === 0 || this.seat < 0) {
      this.predicted = s;
      return;
    }
    const p = cloneState(s);
    // Others keep walking the way they were; nobody else is guessed to drop a push.
    const inputs = this.lastInputs.map((bits) => bits & ~IN_PUSH);
    for (const input of this.pending) {
      if (p.ended) break;
      inputs[this.seat] = input.bits;
      stepInPlace(p, inputs);
    }
    this.predicted = p;
  }

  /** Inputs not yet acknowledged by the server (for tests and the ping display). */
  get unacknowledged(): number {
    return this.pending.length;
  }
}

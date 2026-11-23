/**
 * Messages between a client and its room (GAME_PLAN.md §11). The shapes here are what the room
 * and the client handle; src/core/codec.ts turns them into bytes and back, strictly.
 */
import type { GameState } from "./state";

export const PROTOCOL_VERSION = 1;

export type SeatKind = "empty" | "human" | "bot";

export type SeatView = {
  readonly kind: SeatKind;
  readonly name: string;
  readonly ready: boolean;
  /** A human whose connection dropped (a bot holds the seat). */
  readonly away: boolean;
};

export type RoomPhase = "lobby" | "playing" | "result";

export type LobbyView = {
  readonly code: string;
  readonly phase: RoomPhase;
  readonly seats: readonly SeatView[];
  /** The seat that can change settings and start. */
  readonly host: number;
  readonly mapId: string;
  readonly minutes: number;
  /** Seats that asked for a rematch on the result screen. */
  readonly rematch: readonly boolean[];
};

export type ClientMessage =
  | { readonly t: "join"; readonly name: string; readonly token: string }
  | { readonly t: "input"; readonly seq: number; readonly bits: number }
  | { readonly t: "ready"; readonly ready: boolean }
  | { readonly t: "settings"; readonly mapId: string; readonly minutes: number }
  | { readonly t: "start" }
  | { readonly t: "rematch" }
  | { readonly t: "lobby" }
  | { readonly t: "leave" }
  /** Asks for a snapshot (after a hash mismatch). */
  | { readonly t: "sync" }
  | { readonly t: "ping"; readonly id: number };

export type MatchStart = {
  readonly seed: number;
  readonly mapId: string;
  readonly ticks: number;
  readonly freeze: boolean;
  readonly version: number;
};

export type ServerMessage =
  | { readonly t: "welcome"; readonly seat: number; readonly token: string }
  | { readonly t: "lobby"; readonly lobby: LobbyView }
  | { readonly t: "start"; readonly match: MatchStart }
  /** The inputs every seat played on `tick`, and the last input `seq` the room had from each. */
  | {
      readonly t: "tick";
      readonly tick: number;
      readonly inputs: readonly number[];
      readonly acks: readonly number[];
    }
  | { readonly t: "hash"; readonly tick: number; readonly hash: number }
  | { readonly t: "snapshot"; readonly match: MatchStart; readonly state: GameState }
  | { readonly t: "pong"; readonly id: number }
  | { readonly t: "error"; readonly code: ErrorCode };

export type ErrorCode = "full" | "bad-message" | "not-host" | "rate" | "closed" | "version";

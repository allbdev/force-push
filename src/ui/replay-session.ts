/**
 * Watching a replay: a MatchClient fed the recorded ticks one by one, as if a room sent them, so
 * the renderer, HUD and result work unchanged. Also the end-of-match highlight (board 4): a few
 * seconds around the biggest push, with the close camera.
 */
import { BRANCHES } from "../content/branches";
import type { LobbyView, MatchStart } from "../core/protocol";
import { biggestPushTick, replayState, type Replay } from "../core/replay";
import { SEATS } from "../core/state";
import { MatchClient } from "../net/client";
import type { Session } from "./session";

function replayLobby(phase: LobbyView["phase"], mapId: string, minutes: number): LobbyView {
  return {
    code: "REPLAY",
    phase,
    seats: BRANCHES.map(() => ({ kind: "bot" as const, name: "", ready: false, away: false })),
    host: 0,
    mapId,
    minutes,
    rematch: BRANCHES.map(() => false),
  };
}

export class ReplaySession implements Session {
  readonly client = new MatchClient(() => {});
  readonly code = null;
  readonly offline = true;
  private t: number;
  private readonly end: number;
  private readonly match: MatchStart;

  constructor(
    private readonly replay: Replay,
    from = 0,
    to = replay.inputs.length / SEATS,
    private onDone?: () => void,
  ) {
    this.t = from;
    this.end = to;
    this.match = {
      seed: replay.seed,
      mapId: replay.mapId,
      ticks: replay.ticks,
      freeze: replay.freeze,
      version: replay.version,
    };
    this.client.receive({ t: "welcome", seat: -1, token: "" });
    this.client.receive({
      t: "lobby",
      lobby: replayLobby("playing", replay.mapId, Math.round(replay.ticks / 1200)),
    });
    this.client.receive({ t: "snapshot", match: this.match, state: replayState(replay, from) });
  }

  tick(): void {
    const s = this.client.confirmed;
    if (!s) return;
    if (this.t >= this.end || s.ended) {
      if (this.onDone) {
        const done = this.onDone;
        // Called once; the app swaps this session out.
        this.onDone = undefined;
        done();
      } else if (this.client.lobby?.phase !== "result") {
        this.client.receive({
          t: "lobby",
          lobby: replayLobby("result", this.replay.mapId, Math.round(this.replay.ticks / 1200)),
        });
      }
      return;
    }
    const inputs = Array.from(this.replay.inputs.subarray(this.t * SEATS, this.t * SEATS + SEATS));
    this.client.receive({ t: "tick", tick: s.tick, inputs, acks: [0, 0, 0, 0] });
    this.t++;
  }

  ping(): number | null {
    return null;
  }

  close(): void {}
}

/** What board 4 shows about the biggest push: where, whose, and the diff it made. */
export type Highlight = {
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly seat: number;
  readonly gained: number;
  /** Tiles taken from each other branch (by seat), and boxes broken. */
  readonly lost: readonly number[];
  readonly boxes: number;
};

export function findHighlight(replay: Replay): Highlight | null {
  const t = biggestPushTick(replay);
  if (t < 0) return null;
  const before = replayState(replay, t);
  const after = replayState(replay, t + 1);
  const blast = after.events
    .filter((e) => e.type === "blast")
    .sort((a, b) => (b.type === "blast" && a.type === "blast" ? b.gained - a.gained : 0))[0];
  if (!blast || blast.type !== "blast") return null;
  const lost = [0, 0, 0, 0];
  for (let i = 0; i < after.owner.length; i++) {
    if (
      after.owner[i] === blast.seat + 1 &&
      before.owner[i] !== after.owner[i] &&
      before.owner[i]! > 0
    )
      lost[before.owner[i]! - 1]! += 1;
  }
  const boxes = after.events.filter((e) => e.type === "box" && e.seat === blast.seat).length;
  return { tick: t, x: blast.x, y: blast.y, seat: blast.seat, gained: blast.gained, lost, boxes };
}

/** Seconds of play before and after the blast that the highlight shows. */
export const HIGHLIGHT_BEFORE = 70;
export const HIGHLIGHT_AFTER = 30;

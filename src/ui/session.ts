/**
 * A session is a client talking to a room. `LocalSession` runs the room in the page (offline, bots
 * only): the same Room and MatchClient as online, joined by the in-page transport. The online
 * session (src/net/socket-session.ts) has the same shape.
 */
import { LocalTransport } from "../core/local-transport";
import { Room } from "../core/room";
import { MatchClient } from "../net/client";

export interface Session {
  readonly client: MatchClient;
  /** The room code to show, or null offline. */
  readonly code: string | null;
  readonly offline: boolean;
  /** One local tick with this tick's input bits. */
  tick(bits: number): void;
  /** Round-trip time in ms, when known. */
  ping(): number | null;
  /** Called when the connection state changes (online only). */
  onStatus?: (status: "connecting" | "open" | "lost" | "closed") => void;
  close(): void;
}

export class LocalSession implements Session {
  readonly client: MatchClient;
  readonly code = null;
  readonly offline = true;
  readonly room: Room;
  private readonly transport = new LocalTransport();

  constructor(name: string, random: () => number, spectate = false) {
    this.room = new Room({ code: "LOCAL", transport: this.transport, random });
    this.client = new MatchClient((m) => this.room.receive("me", m));
    this.transport.listen("me", (m) => this.client.receive(m));
    if (!spectate) this.client.join(name);
  }

  /** Watch an all-bot match (captures, `?bots=4`). */
  startWatching(): void {
    // A spectator needs a seated player to start; seat a bot host that leaves at once.
    const host = new MatchClient((m) => this.room.receive("host", m));
    this.transport.listen("host", (m) => host.receive(m));
    host.join("");
    this.room.receive("host", { t: "start" });
    this.room.receive("host", { t: "leave" });
    this.transport.forget("host");
    this.room.watch("me");
  }

  tick(bits: number): void {
    this.client.tick(bits);
    this.room.advance();
  }

  ping(): number | null {
    return null;
  }

  close(): void {
    this.transport.forget("me");
  }
}

/** Random unsigned 32-bit integers from the browser's crypto (never in src/core). */
export function cryptoRandom(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0]!;
}

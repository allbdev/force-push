/**
 * The room host: one Room, its sockets, its clock and its limits. Independent of Cloudflare so it
 * can be tested with fake sockets; server/room-object.ts is the thin Durable Object around it.
 *
 * Everything a client sends is untrusted: message size cap, a token bucket per connection, strict
 * decoding (src/core/codec.ts), and repeat offenders are disconnected.
 */
import { decodeClient, encodeServer, MAX_CLIENT_BYTES } from "../src/core/codec";
import type { ServerMessage } from "../src/core/protocol";
import { Room } from "../src/core/room";
import { dailyId, parseDailyId } from "../src/core/daily";

export interface HostSocket {
  send(data: string | Uint8Array): void;
  close(code: number, reason: string): void;
}

export const LIMITS = {
  /** Players plus spectators in one room. */
  maxConnections: 12,
  /** Token bucket per connection: burst, and refill per second (inputs come 20 a second). */
  burst: 60,
  perSecond: 40,
  /** Bad or over-limit messages before the connection is closed. */
  strikes: 20,
  /** A room with nobody in it closes after this long. */
  idleMs: 5 * 60 * 1000,
  tickMs: 50,
} as const;

type Conn = { socket: HostSocket; tokens: number; last: number; strikes: number };

export class RoomHost {
  readonly room: Room;
  private readonly conns = new Map<string, Conn>();
  private nextId = 1;
  private readonly now: () => number;
  private emptySince: number;
  private ticked = 0;
  private clockStart = -1;

  constructor(code: string, random: () => number, now: () => number) {
    this.now = now;
    this.emptySince = now();
    this.room = new Room({
      code,
      random,
      transport: {
        send: (clientId, message) => this.deliver(clientId, message),
      },
    });
  }

  get connections(): number {
    return this.conns.size;
  }

  /** A new socket; returns its id, or null when the room is full (the socket is closed). */
  connect(socket: HostSocket): string | null {
    if (this.conns.size >= LIMITS.maxConnections) {
      socket.send(encodeServer({ t: "error", code: "full" }));
      socket.close(1013, "full");
      return null;
    }
    const id = `c${this.nextId++}`;
    this.conns.set(id, { socket, tokens: LIMITS.burst, last: this.now(), strikes: 0 });
    return id;
  }

  message(id: string, data: string | ArrayBuffer | Uint8Array): void {
    const c = this.conns.get(id);
    if (!c) return;
    const size = typeof data === "string" ? data.length : data.byteLength;
    if (size > MAX_CLIENT_BYTES) {
      this.kick(id, 1009, "too big");
      return;
    }
    const now = this.now();
    c.tokens = Math.min(LIMITS.burst, c.tokens + ((now - c.last) / 1000) * LIMITS.perSecond);
    c.last = now;
    const msg = decodeClient(data);
    if (!msg) {
      this.strike(id, "bad-message");
      return;
    }
    if (c.tokens < 1) {
      // Over the rate: extra inputs are just dropped (only the latest one counts anyway);
      // anything else over the rate is a strike.
      if (msg.t !== "input") this.strike(id, "rate");
      else if (c.tokens < -LIMITS.burst) this.strike(id, "rate");
      c.tokens -= msg.t === "input" ? 0.25 : 0;
      return;
    }
    c.tokens -= 1;
    // Daily maps cost a few bot simulations to build: only today's (give or take a day, for time
    // zones) are accepted, so nobody can make the room generate thousands of them.
    if (
      msg.t === "settings" &&
      parseDailyId(msg.mapId) &&
      !this.recentDailies().includes(msg.mapId)
    ) {
      this.strike(id, "bad-message");
      return;
    }
    this.room.receive(id, msg);
  }

  disconnect(id: string): void {
    if (!this.conns.delete(id)) return;
    this.room.disconnect(id);
    if (this.conns.size === 0) this.emptySince = this.now();
  }

  /**
   * Advances the room's clock: as many ticks as are due since the match clock started (at most
   * a few per call, so a stall doesn't fast-forward the game).
   */
  pump(): void {
    if (this.room.phase !== "playing") {
      this.clockStart = -1;
      return;
    }
    const now = this.now();
    if (this.clockStart < 0) {
      this.clockStart = now;
      this.ticked = 0;
    }
    const due = Math.floor((now - this.clockStart) / LIMITS.tickMs);
    let steps = 0;
    while (this.ticked < due && steps < 5) {
      this.room.advance();
      this.ticked++;
      steps++;
    }
    if (this.ticked < due) {
      // Too far behind: drop the backlog rather than racing.
      this.clockStart = now - this.ticked * LIMITS.tickMs;
    }
  }

  /** The daily map ids for yesterday, today and tomorrow (UTC), by the host's clock. */
  recentDailies(): string[] {
    return [-1, 0, 1].map((d) => {
      const day = new Date(this.now() + d * 86_400_000);
      return dailyId(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate());
    });
  }

  /** Nobody connected for `idleMs`: the room can close. */
  idle(): boolean {
    return this.conns.size === 0 && this.now() - this.emptySince >= LIMITS.idleMs;
  }

  closeAll(): void {
    for (const id of [...this.conns.keys()]) this.kick(id, 1001, "room closed");
  }

  private strike(id: string, code: "rate" | "bad-message"): void {
    const c = this.conns.get(id);
    if (!c) return;
    c.strikes++;
    if (c.strikes >= LIMITS.strikes) {
      this.kick(id, 1008, code);
      return;
    }
    if (c.strikes === 1 || c.strikes % 5 === 0) this.deliver(id, { t: "error", code });
  }

  private kick(id: string, code: number, reason: string): void {
    const c = this.conns.get(id);
    if (!c) return;
    try {
      c.socket.close(code, reason);
    } catch {
      // Already closed.
    }
    this.disconnect(id);
  }

  private deliver(id: string, message: ServerMessage): void {
    const c = this.conns.get(id);
    if (!c) return;
    try {
      c.socket.send(encodeServer(message));
    } catch {
      this.disconnect(id);
    }
  }
}

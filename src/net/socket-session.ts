/**
 * The online session: a MatchClient over a WebSocket to the room's Durable Object. Rejoins with
 * the saved token after a drop (a bot holds the seat meanwhile), pings for the HUD, and can
 * simulate a bad network with `?lag=<ms>&jitter=<ms>` (never linked from the UI).
 */
import { decodeServer, encodeClient } from "../core/codec";
import type { ClientMessage } from "../core/protocol";
import type { Session } from "../ui/session";
import { MatchClient } from "./client";

export type NetOptions = {
  readonly lag: number;
  readonly jitter: number;
  readonly loadToken: (code: string) => string;
  readonly saveToken: (code: string, token: string) => void;
};

/** Asks the Worker for a fresh room. Null when there's no room server (offline). */
export async function createRoom(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher("/api/room", { method: "POST" });
    if (res.status !== 201) return null;
    const body = (await res.json()) as unknown;
    if (typeof body !== "object" || body === null) return null;
    const code = (body as { code?: unknown }).code;
    return typeof code === "string" && /^[A-Z]{3}-\d{4}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** A queue that delays messages by lag ± jitter while keeping their order. */
class Delay {
  private last = 0;
  constructor(
    private readonly lag: number,
    private readonly jitter: number,
  ) {}
  run(f: () => void): void {
    if (this.lag <= 0 && this.jitter <= 0) return f();
    const at = Math.max(performance.now() + this.lag + Math.random() * this.jitter, this.last);
    this.last = at;
    setTimeout(f, at - performance.now());
  }
}

export class SocketSession implements Session {
  readonly client: MatchClient;
  readonly offline = false;
  onStatus?: (status: "connecting" | "open" | "lost" | "closed") => void;
  private ws: WebSocket | null = null;
  private closed = false;
  private retries = 0;
  private rtt: number | null = null;
  private pingId = 0;
  private pingSent = new Map<number, number>();
  private pinger: ReturnType<typeof setInterval> | null = null;
  private readonly up: Delay;
  private readonly down: Delay;
  private everOpened = false;

  constructor(
    readonly code: string,
    private readonly name: string,
    private readonly options: NetOptions,
  ) {
    this.up = new Delay(options.lag, options.jitter);
    this.down = new Delay(options.lag, options.jitter);
    this.client = new MatchClient((m) => this.send(m));
    this.open();
  }

  private url(): string {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/api/room/${this.code}/ws`;
  }

  private open(): void {
    this.onStatus?.("connecting");
    const ws = new WebSocket(this.url());
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.retries = 0;
      this.everOpened = true;
      this.client.join(this.name, this.options.loadToken(this.code));
      this.onStatus?.("open");
      this.pinger = setInterval(() => this.sendPing(), 2000);
      this.sendPing();
    });
    ws.addEventListener("message", (e: MessageEvent<string | ArrayBuffer>) => {
      const data = e.data;
      this.down.run(() => this.receive(data));
    });
    ws.addEventListener("close", () => {
      if (this.pinger) clearInterval(this.pinger);
      this.pinger = null;
      if (this.closed) return;
      if (!this.everOpened || this.retries >= 6) {
        this.closed = true;
        this.onStatus?.("closed");
        return;
      }
      this.onStatus?.("lost");
      const wait = Math.min(8000, 500 * 2 ** this.retries++);
      setTimeout(() => {
        if (!this.closed) this.open();
      }, wait);
    });
  }

  private receive(data: string | ArrayBuffer): void {
    const m = decodeServer(data);
    if (!m) return;
    if (m.t === "pong") {
      const sent = this.pingSent.get(m.id);
      if (sent !== undefined) this.rtt = Math.round(performance.now() - sent);
      this.pingSent.delete(m.id);
      return;
    }
    this.client.receive(m);
    if (m.t === "welcome" && m.token) this.options.saveToken(this.code, m.token);
  }

  private sendPing(): void {
    const id = ++this.pingId;
    this.pingSent.set(id, performance.now());
    if (this.pingSent.size > 8) this.pingSent.delete(this.pingSent.keys().next().value!);
    this.send({ t: "ping", id });
  }

  private send(m: ClientMessage): void {
    const ws = this.ws;
    const data = encodeClient(m);
    this.up.run(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data);
    });
  }

  tick(bits: number): void {
    this.client.tick(bits);
  }

  ping(): number | null {
    return this.rtt;
  }

  close(): void {
    this.closed = true;
    if (this.pinger) clearInterval(this.pinger);
    this.ws?.close(1000, "bye");
  }
}

/**
 * One Durable Object per room: wraps a RoomHost, accepts WebSockets, runs the 20-tick clock while
 * anyone is connected, and forgets everything once the room has been empty for five minutes.
 * Nothing is written to storage: a room lives in memory only (GAME_PLAN.md D10).
 */
import { DurableObject } from "cloudflare:workers";
import { RoomHost, LIMITS } from "./host";
import type { Env } from "./worker";

function randomU32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export class RoomObject extends DurableObject<Env> {
  private host: RoomHost | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    if (url.pathname === "/create") {
      if (this.host) return new Response("taken", { status: 409 });
      this.host = new RoomHost(code, randomU32, () => Date.now());
      await this.ctx.storage.setAlarm(Date.now() + LIMITS.idleMs);
      return new Response("created", { status: 201 });
    }
    if (url.pathname === "/ws") {
      if (!this.host) return new Response("no such room", { status: 404 });
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      server.accept();
      const host = this.host;
      const id = host.connect({
        send: (data) => server.send(data),
        close: (c, reason) => server.close(c, reason),
      });
      if (id) {
        // Binary frames can arrive as a Blob; read them in order before handing them on.
        let queue = Promise.resolve();
        server.addEventListener("message", (e) => {
          const data = e.data as string | ArrayBuffer | Blob;
          if (typeof data === "string" || data instanceof ArrayBuffer) {
            queue = queue.then(() => host.message(id, data));
          } else if (data.size <= 1024) {
            queue = queue.then(async () => host.message(id, await data.arrayBuffer()));
          } else {
            server.close(1009, "too big");
          }
        });
        const gone = () => {
          host.disconnect(id);
          if (host.connections === 0) this.stopClock();
        };
        server.addEventListener("close", gone);
        server.addEventListener("error", gone);
        this.startClock();
      }
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("not found", { status: 404 });
  }

  private startClock(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.host?.pump(), LIMITS.tickMs / 2);
  }

  private stopClock(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx.storage.setAlarm(Date.now() + LIMITS.idleMs);
  }

  async alarm(): Promise<void> {
    if (this.host?.idle()) {
      this.host.closeAll();
      this.host = null;
      this.stopClockOnly();
    } else if (this.host) {
      await this.ctx.storage.setAlarm(Date.now() + LIMITS.idleMs);
    }
  }

  private stopClockOnly(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

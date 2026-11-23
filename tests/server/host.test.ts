import { describe, expect, it } from "vitest";
import { decodeServer, encodeClient } from "../../src/core/codec";
import type { ClientMessage, ServerMessage } from "../../src/core/protocol";
import { LIMITS, RoomHost, type HostSocket } from "../../server/host";
import { originAllowed } from "../../server/origin";

class FakeSocket implements HostSocket {
  sent: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  send(data: string | Uint8Array): void {
    const m = decodeServer(typeof data === "string" ? data : (data.buffer.slice(0) as ArrayBuffer));
    if (m) this.sent.push(m);
  }
  close(code: number, reason: string): void {
    this.closed = { code, reason };
  }
  last<T extends ServerMessage["t"]>(t: T) {
    return [...this.sent].reverse().find((m) => m.t === t) as
      Extract<ServerMessage, { t: T }> | undefined;
  }
}

function setup() {
  let now = 1_000_000;
  let n = 1;
  const host = new RoomHost(
    "FRI-1758",
    () => n++ * 7919,
    () => now,
  );
  return { host, advance: (ms: number) => (now += ms) };
}

const wire = (m: ClientMessage) => {
  const e = encodeClient(m);
  return typeof e === "string" ? e : (e.buffer.slice(0) as ArrayBuffer);
};

describe("room host", () => {
  it("joins players and runs the clock at 20 ticks a second while playing", () => {
    const { host, advance } = setup();
    const a = new FakeSocket();
    const id = host.connect(a)!;
    host.message(id, wire({ t: "join", name: "Ana", token: "" }));
    expect(a.last("welcome")!.seat).toBe(0);
    host.message(id, wire({ t: "start" }));
    host.pump();
    for (let k = 0; k < 100; k++) {
      advance(25);
      host.pump();
    }
    expect(host.room.state!.tick).toBe(50);
  });

  it("doesn't fast-forward after a stall", () => {
    const { host, advance } = setup();
    const id = host.connect(new FakeSocket())!;
    host.message(id, wire({ t: "join", name: "", token: "" }));
    host.message(id, wire({ t: "start" }));
    host.pump();
    advance(10_000);
    host.pump();
    expect(host.room.state!.tick).toBeLessThanOrEqual(5);
  });

  it("closes a connection that sends a message over the size cap", () => {
    const { host } = setup();
    const a = new FakeSocket();
    const id = host.connect(a)!;
    host.message(id, "x".repeat(10_000));
    expect(a.closed?.code).toBe(1009);
    expect(host.connections).toBe(0);
  });

  it("strikes malformed messages and closes repeat offenders", () => {
    const { host } = setup();
    const a = new FakeSocket();
    const id = host.connect(a)!;
    host.message(id, "{nope");
    expect(a.last("error")!.code).toBe("bad-message");
    for (let k = 0; k < LIMITS.strikes; k++) host.message(id, '{"t":"evil"}');
    expect(a.closed?.code).toBe(1008);
  });

  it("drops a flood of inputs quietly but closes a flood of other messages", () => {
    const { host } = setup();
    const a = new FakeSocket();
    const id = host.connect(a)!;
    host.message(id, wire({ t: "join", name: "", token: "" }));
    for (let k = 0; k < 200; k++) host.message(id, wire({ t: "input", seq: k + 1, bits: 2 }));
    expect(a.closed).toBeNull();
    const b = new FakeSocket();
    const id2 = host.connect(b)!;
    for (let k = 0; k < 500; k++) host.message(id2, wire({ t: "ping", id: k }));
    expect(b.closed?.code).toBe(1008);
  });

  it("refuses connections past the limit", () => {
    const { host } = setup();
    for (let k = 0; k < LIMITS.maxConnections; k++)
      expect(host.connect(new FakeSocket())).not.toBeNull();
    const extra = new FakeSocket();
    expect(host.connect(extra)).toBeNull();
    expect(extra.last("error")!.code).toBe("full");
    expect(extra.closed?.code).toBe(1013);
  });

  it("is idle five minutes after the last person leaves", () => {
    const { host, advance } = setup();
    const id = host.connect(new FakeSocket())!;
    host.message(id, wire({ t: "join", name: "", token: "" }));
    host.disconnect(id);
    advance(LIMITS.idleMs - 1);
    expect(host.idle()).toBe(false);
    advance(1);
    expect(host.idle()).toBe(true);
  });

  it("ignores messages from unknown connections", () => {
    const { host } = setup();
    expect(() => host.message("ghost", wire({ t: "start" }))).not.toThrow();
  });
});

describe("origin check", () => {
  it("lets only the site (or same origin, or localhost in dev) open rooms", () => {
    const site = "https://force-push.vinicius-albuquerque.com.br";
    expect(originAllowed(site, `${site}/api/room`, false)).toBe(true);
    expect(originAllowed("https://evil.example", `${site}/api/room`, false)).toBe(false);
    expect(originAllowed(null, `${site}/api/room`, false)).toBe(false);
    expect(originAllowed("http://localhost:5173", `${site}/api/room`, false)).toBe(false);
    expect(originAllowed("http://localhost:5173", `${site}/api/room`, true)).toBe(true);
    expect(originAllowed("http://localhost.evil.example:80", `${site}/api/room`, true)).toBe(false);
  });
});

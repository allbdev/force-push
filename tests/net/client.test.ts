import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { ClientMessage, ServerMessage } from "../../src/core/protocol";
import { Room, type RoomTransport } from "../../src/core/room";
import { hashState, IN_PUSH, IN_RIGHT } from "../../src/core/state";
import { MatchClient } from "../../src/net/client";
import { LocalTransport } from "../../src/core/local-transport";

/** Messages in flight over a simulated network: per-link latency and jitter, order preserved. */
class Network implements RoomTransport {
  now = 0;
  private queue: { at: number; deliver: () => void }[] = [];
  private lastAt = new Map<string, number>();
  constructor(private readonly delay: (link: string) => number) {}

  schedule(link: string, deliver: () => void): void {
    // WebSockets keep order: a message never overtakes the one before it on the same link.
    const at = Math.max(this.now + this.delay(link), this.lastAt.get(link) ?? 0);
    this.lastAt.set(link, at);
    this.queue.push({ at, deliver });
  }

  clients = new Map<string, MatchClient>();
  send(clientId: string, message: ServerMessage): void {
    const copy = structuredClone(message);
    this.schedule(`down:${clientId}`, () => this.clients.get(clientId)?.receive(copy));
  }

  deliverDue(): void {
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const next = this.queue[0];
      if (!next || next.at > this.now) return;
      this.queue.shift();
      next.deliver();
    }
  }

  get idle(): boolean {
    return this.queue.length === 0;
  }
}

describe("MatchClient over a local transport", () => {
  it("follows the room exactly with no latency", () => {
    const transport = new LocalTransport();
    let n = 1;
    const room = new Room({ code: "FRI-1758", transport, random: () => n++ });
    const client = new MatchClient((m) => room.receive("a", m));
    transport.listen("a", (m) => client.receive(m));
    client.join("Ana");
    client.send({ t: "start" });
    for (let k = 0; k < 200; k++) {
      client.tick(k % 40 < 20 ? IN_RIGHT : IN_PUSH);
      room.advance();
      expect(hashState(client.confirmed!)).toBe(hashState(room.state!));
      expect(client.unacknowledged).toBe(0);
      expect(client.predicted).toBe(client.confirmed);
    }
  });
});

describe("netcode (property)", () => {
  it("every predicting client ends each tick in the server's state once the inputs arrive", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.integer({ min: 0, max: 8 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 3, maxLength: 3 }),
        fc.array(fc.integer({ min: 0, max: 31 }), { minLength: 40, maxLength: 160 }),
        fc.integer(),
        (players, latency, jitter, script, salt) => {
          let r = salt;
          const rand = () => {
            r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
            return r >>> 0;
          };
          const net = new Network((link) => {
            const k = Number(link.slice(-1));
            return latency[k]! + (rand() % (jitter[k]! + 1));
          });
          let n = 1;
          const room = new Room({ code: "TST-0001", transport: net, random: () => n++ * 7919 });
          const ids = Array.from({ length: players }, (_, k) => `c${k}`);
          ids.forEach((id) => {
            const client = new MatchClient((m: ClientMessage) => {
              const copy = structuredClone(m);
              net.schedule(`up:${id}`, () => room.receive(id, copy));
            });
            net.clients.set(id, client);
            client.join(id);
          });
          // Let the joins land (however slow the links), then the host starts.
          const host = () => [...net.clients.values()].find((c) => c.seat === 0);
          for (let k = 0; k < 200 && !host(); k++) {
            net.now++;
            net.deliverDue();
          }
          host()!.send({ t: "start" });
          const serverHash = new Map<number, number>();
          for (let k = 0; k < script.length + 40; k++) {
            net.now++;
            net.deliverDue();
            ids.forEach((id, i) => net.clients.get(id)!.tick(script[(k + i * 7) % script.length]!));
            room.advance();
            if (room.state) serverHash.set(room.state.tick, hashState(room.state));
            for (const client of net.clients.values())
              if (client.confirmed && serverHash.has(client.confirmed.tick))
                expect(hashState(client.confirmed)).toBe(serverHash.get(client.confirmed.tick));
          }
          // Drain: once everything has arrived, every client is exactly where the server is.
          while (!net.idle) {
            net.now++;
            net.deliverDue();
          }
          for (const client of net.clients.values()) {
            expect(client.confirmed!.tick).toBe(room.state!.tick);
            expect(hashState(client.confirmed!)).toBe(hashState(room.state!));
            expect(client.mismatches).toBe(0);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe("prediction", () => {
  it("moves your own player at once while the server's ticks are still on their way", () => {
    const net = new Network(() => 4);
    let n = 1;
    const room = new Room({ code: "TST-0002", transport: net, random: () => n++ });
    const client = new MatchClient((m) => net.schedule("up:a", () => room.receive("a", m)));
    net.clients.set("a", client);
    client.join("a");
    for (let k = 0; k < 10; k++) {
      net.now++;
      net.deliverDue();
    }
    client.send({ t: "start" });
    for (let k = 0; k < 10; k++) {
      net.now++;
      net.deliverDue();
      room.advance();
    }
    // The first tick each view reaches the next tile: the prediction gets there a round trip early.
    let predictedAt = -1;
    let confirmedAt = -1;
    for (let k = 0; k < 30; k++) {
      net.now++;
      net.deliverDue();
      client.tick(IN_RIGHT);
      room.advance();
      if (predictedAt < 0 && client.predicted!.players[0]!.x >= 1) predictedAt = k;
      if (confirmedAt < 0 && client.confirmed!.players[0]!.x >= 1) confirmedAt = k;
      if (k === 5) expect(client.unacknowledged).toBeGreaterThan(0);
    }
    expect(predictedAt).toBeGreaterThanOrEqual(0);
    expect(confirmedAt - predictedAt).toBeGreaterThanOrEqual(6);
  });
});

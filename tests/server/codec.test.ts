import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  decodeClient,
  decodeServer,
  encodeClient,
  encodeServer,
  MAX_CLIENT_BYTES,
  stateFromJson,
  stateToJson,
} from "../../src/core/codec";
import type { ClientMessage, ServerMessage } from "../../src/core/protocol";
import { createMatch, hashState } from "../../src/core/state";
import { stepInPlace } from "../../src/core/step";
import { mapById } from "../../src/content/maps";

const toWire = (e: string | Uint8Array) =>
  typeof e === "string" ? e : (e.buffer.slice(0) as ArrayBuffer);

const clientArb: fc.Arbitrary<ClientMessage> = fc.oneof(
  fc.record({ t: fc.constant("input" as const), seq: fc.nat(0xffffffff), bits: fc.nat(31) }),
  fc.record({
    t: fc.constant("join" as const),
    name: fc.string({ maxLength: 12 }),
    token: fc.stringMatching(/^[a-z0-9]{0,28}$/),
  }),
  fc.record({ t: fc.constant("ready" as const), ready: fc.boolean() }),
  fc.record({
    t: fc.constant("settings" as const),
    mapId: fc.constantFrom("open-space", "rooftop"),
    minutes: fc.constantFrom(2, 3, 5),
  }),
  fc.record({ t: fc.constant("ping" as const), id: fc.nat(0xffffffff) }),
  fc.constantFrom<ClientMessage>(
    { t: "start" },
    { t: "rematch" },
    { t: "lobby" },
    { t: "leave" },
    { t: "sync" },
  ),
);

describe("codec: client → server", () => {
  it("round-trips every message", () => {
    fc.assert(
      fc.property(clientArb, (m) => {
        expect(decodeClient(toWire(encodeClient(m)))).toEqual(m);
      }),
    );
  });

  it("an input is 6 bytes", () => {
    expect((encodeClient({ t: "input", seq: 1, bits: 31 }) as Uint8Array).byteLength).toBe(6);
  });

  it("rejects malformed messages without throwing", () => {
    const bad: (string | ArrayBuffer)[] = [
      "",
      "{",
      "null",
      "[]",
      '{"t":"nope"}',
      '{"t":"start","x":1}',
      '{"t":"join","name":"a","token":"UPPER"}',
      '{"t":"join","name":5,"token":""}',
      '{"t":"settings","mapId":"../etc","minutes":3}',
      '{"t":"ready","ready":"yes"}',
      '{"t":"ping","id":-1}',
      '{"__proto__":{"t":"start"}}',
      "x".repeat(MAX_CLIENT_BYTES + 1),
      new Uint8Array([1, 0, 0, 0, 1, 32]).buffer,
      new Uint8Array([1, 0, 0, 0, 1]).buffer,
      new Uint8Array([9, 0, 0, 0, 1, 1]).buffer,
    ];
    for (const b of bad) expect(decodeClient(b), String(b).slice(0, 40)).toBeNull();
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.uint8Array().map((a) => a.buffer as ArrayBuffer),
        ),
        (b) => {
          expect(() => decodeClient(b)).not.toThrow();
        },
      ),
    );
    fc.assert(
      fc.property(fc.json(), (j) => {
        expect(() => decodeClient(j)).not.toThrow();
      }),
    );
  });
});

describe("codec: server → client", () => {
  it("round-trips ticks, hashes and lobby messages; a tick is 25 bytes for four seats", () => {
    const tick: ServerMessage = {
      t: "tick",
      tick: 1234,
      inputs: [1, 2, 16, 31],
      acks: [9, 0, 77, 1 << 30],
    };
    const enc = encodeServer(tick) as Uint8Array;
    expect(enc.byteLength).toBe(25);
    expect(decodeServer(toWire(enc))).toEqual(tick);
    const hash: ServerMessage = { t: "hash", tick: 20, hash: 0xdeadbeef };
    expect(decodeServer(toWire(encodeServer(hash)))).toEqual(hash);
    const lobby: ServerMessage = {
      t: "lobby",
      lobby: {
        code: "FRI-1758",
        phase: "lobby",
        seats: [
          { kind: "human", name: "Ana", ready: true, away: false },
          { kind: "bot", name: "", ready: false, away: false },
          { kind: "empty", name: "", ready: false, away: false },
          { kind: "human", name: "Bia", ready: false, away: true },
        ],
        host: 0,
        mapId: "open-space",
        minutes: 3,
        rematch: [false, false, false, false],
      },
    };
    expect(decodeServer(toWire(encodeServer(lobby)))).toEqual(lobby);
  });

  it("round-trips a snapshot to an identical state (same hash)", () => {
    const s = createMatch({ map: mapById("open-space")!, seed: 99, ticks: 2000, freeze: true });
    for (let k = 0; k < 400; k++)
      stepInPlace(s, [k % 31, (k * 3) % 31, (k * 5) % 31, (k * 7) % 31]);
    const msg = encodeServer({
      t: "snapshot",
      match: { seed: 99, mapId: "open-space", ticks: 2000, freeze: true, version: 1 },
      state: s,
    });
    const back = decodeServer(toWire(msg));
    expect(back?.t).toBe("snapshot");
    if (back?.t === "snapshot") expect(hashState(back.state)).toBe(hashState(s));
  });

  it("rejects broken snapshots and lobbies", () => {
    const s = stateToJson(createMatch({ map: mapById("open-space")!, seed: 1, ticks: 10 }));
    expect(stateFromJson({ ...s, owner: [1, 2] })).toBeNull();
    expect(stateFromJson({ ...s, width: 999 })).toBeNull();
    expect(stateFromJson({ ...s, players: [] })).toBeNull();
    expect(decodeServer('{"t":"lobby","lobby":{"code":"<script>"}}')).toBeNull();
    expect(decodeServer('{"t":"welcome","seat":9,"token":""}')).toBeNull();
    fc.assert(
      fc.property(fc.json(), (j) => {
        expect(() => decodeServer(j)).not.toThrow();
      }),
    );
  });
});

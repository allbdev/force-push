import { describe, expect, it } from "vitest";
import { LocalTransport } from "../../src/core/local-transport";
import type { ServerMessage } from "../../src/core/protocol";
import { Room } from "../../src/core/room";
import { hashState } from "../../src/core/state";
import { makeRoomCode, parseRoomCode } from "../../src/core/room-code";
import { cleanName } from "../../src/core/names";
import { TICKS_PER_SECOND } from "../../src/content/rules";

function setup() {
  const transport = new LocalTransport();
  let n = 1;
  const room = new Room({ code: "FRI-1758", transport, random: () => n++ * 2654435761 });
  const inbox: Record<string, ServerMessage[]> = {};
  const client = (id: string) => {
    inbox[id] = [];
    transport.listen(id, (m) => inbox[id]!.push(m));
    return {
      id,
      last: <T extends ServerMessage["t"]>(t: T) =>
        [...inbox[id]!].reverse().find((m) => m.t === t) as
          Extract<ServerMessage, { t: T }> | undefined,
      all: <T extends ServerMessage["t"]>(t: T) =>
        inbox[id]!.filter((m) => m.t === t) as Extract<ServerMessage, { t: T }>[],
    };
  };
  return { room, client, transport };
}

const minutes = (m: number) => m * 60 * TICKS_PER_SECOND;

describe("room", () => {
  it("seats players in branch order and makes the first one the host", () => {
    const { room, client } = setup();
    const a = client("a");
    const b = client("b");
    room.receive("a", { t: "join", name: "Vini", token: "" });
    room.receive("b", { t: "join", name: "Bia", token: "" });
    expect(a.last("welcome")!.seat).toBe(0);
    expect(b.last("welcome")!.seat).toBe(1);
    const lobby = b.last("lobby")!.lobby;
    expect(lobby.seats.map((s) => s.kind)).toEqual(["human", "human", "empty", "empty"]);
    expect(lobby.seats[1]!.name).toBe("Bia");
    expect(lobby.host).toBe(0);
  });

  it("cleans names and drops bad ones", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "<img src=x>", token: "" });
    expect(a.last("lobby")!.lobby.seats[0]!.name).toBe("");
    expect(cleanName("  Ana   Lú  ")).toBe("Ana Lú");
    expect(cleanName("a".repeat(13))).toBe("");
    expect(cleanName("José_O-2")).toBe("José_O-2");
    expect(cleanName("日本語")).toBe("日本語");
    expect(cleanName(42)).toBe("");
  });

  it("only the host changes settings and starts; empty seats become bots", () => {
    const { room, client } = setup();
    const a = client("a");
    const b = client("b");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("b", { t: "join", name: "", token: "" });
    room.receive("b", { t: "start" });
    expect(b.last("error")!.code).toBe("not-host");
    expect(room.phase).toBe("lobby");
    room.receive("a", { t: "settings", mapId: "open-space", minutes: 7 });
    expect(a.last("lobby")!.lobby.minutes).toBe(3);
    room.receive("a", { t: "settings", mapId: "open-space", minutes: 2 });
    expect(a.last("lobby")!.lobby.minutes).toBe(2);
    room.receive("a", { t: "start" });
    expect(room.phase).toBe("playing");
    expect(b.last("start")!.match.ticks).toBe(minutes(2));
    expect(b.last("lobby")!.lobby.seats.map((s) => s.kind)).toEqual([
      "human",
      "human",
      "bot",
      "bot",
    ]);
  });

  it("lets the host close empty seats for a 1v1, and nobody else", () => {
    const { room, client } = setup();
    const a = client("a");
    const b = client("b");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("b", { t: "join", name: "", token: "" });
    room.receive("b", { t: "seat", seat: 2, closed: true });
    expect(b.last("error")!.code).toBe("not-host");
    room.receive("a", { t: "seat", seat: 1, closed: true });
    room.receive("a", { t: "seat", seat: 2, closed: true });
    room.receive("a", { t: "seat", seat: 3, closed: true });
    const kinds = () => a.last("lobby")!.lobby.seats.map((x) => x.kind);
    // A seat with a person in it can't be closed.
    expect(kinds()).toEqual(["human", "human", "closed", "closed"]);
    room.receive("a", { t: "start" });
    const match = b.last("start")!.match;
    expect(match.closed).toBe(0b1100);
    expect(kinds()).toEqual(["human", "human", "closed", "closed"]);
    room.receive("a", { t: "input", seq: 1, bits: 2 });
    for (let k = 0; k < 40; k++) room.advance();
    for (const t of a.all("tick")) expect([t.inputs[2], t.inputs[3]]).toEqual([0, 0]);
    expect(room.state!.players[2]!.out).toBe(-1);
  });

  it("keeps at least two seats open, reopens closed ones, and seats nobody in a closed seat", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "", token: "" });
    for (const seat of [1, 2, 3]) room.receive("a", { t: "seat", seat, closed: true });
    const kinds = () => a.last("lobby")!.lobby.seats.map((x) => x.kind);
    expect(kinds()).toEqual(["human", "closed", "closed", "empty"]);
    room.receive("a", { t: "seat", seat: 0, closed: true });
    expect(kinds()[0]).toBe("human");
    // A friend arrives: the open seat, never a closed one; a third watches.
    const b = client("b");
    room.receive("b", { t: "join", name: "", token: "" });
    expect(b.last("welcome")!.seat).toBe(3);
    const c = client("c");
    room.receive("c", { t: "join", name: "", token: "" });
    expect(c.last("welcome")!.seat).toBe(-1);
    room.receive("a", { t: "seat", seat: 2, closed: false });
    expect(kinds()).toEqual(["human", "closed", "empty", "human"]);
  });

  it("keeps closed seats through the result and a rematch, and can't change them mid-sprint", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("a", { t: "settings", mapId: "open-space", minutes: 2 });
    room.receive("a", { t: "seat", seat: 3, closed: true });
    room.receive("a", { t: "start" });
    room.receive("a", { t: "seat", seat: 3, closed: false });
    room.receive("a", { t: "seat", seat: 2, closed: true });
    expect(a.last("start")!.match.closed).toBe(0b1000);
    for (let k = 0; k < minutes(2); k++) room.advance();
    expect(room.phase).toBe("result");
    room.receive("a", { t: "rematch" });
    expect(a.last("start")!.match.closed).toBe(0b1000);
  });

  it("broadcasts each tick's inputs and a hash every second that matches a replay", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("a", { t: "start" });
    room.receive("a", { t: "input", seq: 1, bits: 2 });
    for (let k = 0; k < TICKS_PER_SECOND; k++) room.advance();
    const ticks = a.all("tick");
    expect(ticks).toHaveLength(TICKS_PER_SECOND);
    expect(ticks[0]!.inputs[0]).toBe(2);
    expect(ticks[0]!.acks[0]).toBe(1);
    expect(a.last("hash")!.hash).toBe(hashState(room.state!));
  });

  it("ignores stale inputs and keeps a quick push tap between two ticks", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("a", { t: "start" });
    room.receive("a", { t: "input", seq: 5, bits: 16 });
    room.receive("a", { t: "input", seq: 6, bits: 0 });
    room.receive("a", { t: "input", seq: 4, bits: 8 });
    room.advance();
    expect(a.last("tick")!.inputs[0]).toBe(16);
    room.advance();
    expect(a.last("tick")!.inputs[0]).toBe(0);
  });

  it("plays a whole sprint, then shows the result and starts a rematch with a new seed", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("a", { t: "settings", mapId: "open-space", minutes: 2 });
    room.receive("a", { t: "start" });
    const first = a.last("start")!.match.seed;
    for (let k = 0; k < minutes(2); k++) room.advance();
    expect(room.phase).toBe("result");
    room.advance();
    expect(a.all("tick")).toHaveLength(minutes(2));
    room.receive("a", { t: "rematch" });
    expect(room.phase).toBe("playing");
    expect(a.last("start")!.match.seed).not.toBe(first);
  });

  it("a dropped player's seat is held by a bot until they come back with their token", () => {
    const { room, client } = setup();
    const a = client("a");
    const b = client("b");
    room.receive("a", { t: "join", name: "Ana", token: "" });
    room.receive("b", { t: "join", name: "Bia", token: "" });
    const token = b.last("welcome")!.token;
    room.receive("a", { t: "start" });
    room.disconnect("b");
    expect(a.last("lobby")!.lobby.seats[1]!.away).toBe(true);
    room.advance();
    const b2 = client("b2");
    room.receive("b2", { t: "join", name: "", token });
    expect(b2.last("welcome")!.seat).toBe(1);
    expect(b2.last("snapshot")!.state.tick).toBe(1);
    expect(a.last("lobby")!.lobby.seats[1]).toMatchObject({ name: "Bia", away: false });
  });

  it("hands the host role on when the host leaves", () => {
    const { room, client } = setup();
    client("a");
    const b = client("b");
    room.receive("a", { t: "join", name: "", token: "" });
    room.receive("b", { t: "join", name: "", token: "" });
    room.receive("a", { t: "leave" });
    expect(b.last("lobby")!.lobby.host).toBe(1);
    expect(room.connected).toBe(1);
  });

  it("a fifth person watches instead of playing", () => {
    const { room, client } = setup();
    for (const id of ["a", "b", "c", "d"]) {
      client(id);
      room.receive(id, { t: "join", name: id, token: "" });
    }
    const e = client("e");
    room.receive("e", { t: "join", name: "e", token: "" });
    expect(e.last("welcome")!.seat).toBe(-1);
    room.receive("a", { t: "start" });
    room.advance();
    expect(e.last("tick")).toBeDefined();
    room.receive("e", { t: "input", seq: 1, bits: 16 });
    room.advance();
    expect(e.last("tick")!.inputs).toEqual(room.state && e.last("tick")!.inputs);
  });

  it("answers pings and ignores messages from strangers", () => {
    const { room, client } = setup();
    const a = client("a");
    room.receive("a", { t: "ping", id: 7 });
    expect(a.last("pong")!.id).toBe(7);
    room.receive("a", { t: "start" });
    expect(room.phase).toBe("lobby");
  });
});

describe("room codes", () => {
  it("are three letters without I or O and four digits", () => {
    for (let k = 0; k < 200; k++) {
      const code = makeRoomCode([k * 7919, k * 104729, k * 15485863, k * 2147483647]);
      expect(code).toMatch(/^[A-HJ-NP-Z]{3}-\d{4}$/);
      expect(parseRoomCode(code)).toBe(code);
    }
  });

  it("parse what people type and reject the rest", () => {
    expect(parseRoomCode(" fri1758 ")).toBe("FRI-1758");
    expect(parseRoomCode("FRI-1758")).toBe("FRI-1758");
    expect(parseRoomCode("FR1-1758")).toBeNull();
    expect(parseRoomCode("FRI-175")).toBeNull();
    expect(parseRoomCode("<script>")).toBeNull();
    expect(parseRoomCode("A".repeat(1000))).toBeNull();
    expect(parseRoomCode(null)).toBeNull();
  });
});

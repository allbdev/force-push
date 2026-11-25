import { describe, expect, it } from "vitest";
import { IN_DOWN, IN_LEFT, IN_PUSH, IN_RIGHT, IN_UP } from "../../src/core/state";
import { InputState, keyBit, stickBits } from "../../src/ui/input";

describe("input", () => {
  it("maps WASD, arrows and space", () => {
    expect(keyBit("KeyW")).toBe(IN_UP);
    expect(keyBit("ArrowLeft")).toBe(IN_LEFT);
    expect(keyBit("Space")).toBe(IN_PUSH);
    expect(keyBit("KeyQ")).toBe(0);
  });

  it("quantises the stick to four directions with a dead zone", () => {
    expect(stickBits(5, 5, 60)).toBe(0);
    expect(stickBits(40, 10, 60)).toBe(IN_RIGHT);
    expect(stickBits(-40, 39, 60)).toBe(IN_LEFT);
    expect(stickBits(10, 40, 60)).toBe(IN_DOWN);
    expect(stickBits(0, -30, 60)).toBe(IN_UP);
    expect(stickBits(10, 10, 0)).toBe(0);
  });

  it("sends a push once per press, even a tap between two samples", () => {
    const input = new InputState();
    input.keyDown("Space");
    input.keyUp("Space");
    expect(input.sample()).toBe(IN_PUSH);
    expect(input.sample()).toBe(0);
    input.keyDown("Space");
    expect(input.sample()).toBe(IN_PUSH);
    expect(input.sample()).toBe(0); // still held: no second push
    input.keyUp("Space");
    input.setTouchPush(true);
    expect(input.sample()).toBe(IN_PUSH);
  });

  it("combines keys and stick and clears on blur", () => {
    const input = new InputState();
    input.keyDown("KeyD");
    input.setStick(IN_DOWN);
    expect(input.sample()).toBe(IN_RIGHT | IN_DOWN);
    input.clear();
    expect(input.sample()).toBe(0);
  });
});

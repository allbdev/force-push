/**
 * The in-browser transport: the room and its one or more clients live in the same page, messages
 * are delivered synchronously. Used by the offline room (first slice) and by tests.
 */
import type { ServerMessage } from "./protocol";
import type { RoomTransport } from "./room";

export class LocalTransport implements RoomTransport {
  private readonly listeners = new Map<string, (message: ServerMessage) => void>();

  listen(clientId: string, onMessage: (message: ServerMessage) => void): void {
    this.listeners.set(clientId, onMessage);
  }

  forget(clientId: string): void {
    this.listeners.delete(clientId);
  }

  send(clientId: string, message: ServerMessage): void {
    this.listeners.get(clientId)?.(message);
  }
}

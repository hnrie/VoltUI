import type { CommandHandler } from "../lib/registry";
import type { ConnectionInfo } from "../../types/client";
import { events } from "../lib/events";

interface Instance extends ConnectionInfo {
  id: string;
  pid: number;
  username: string;
  displayName: string;
  placeId: string;
  connectedAtMs: number;
  status: string;
}

/**
 * The desktop core discovered live client instances over a local pipe. Here a
 * small in-memory set stands in, seeded so the UI has something to render and
 * mutated by the account manager when accounts launch and stop.
 */
class ConnectionRegistry {
  private readonly instances = new Map<string, Instance>();
  private sequence = 0;

  list(): Instance[] {
    return [...this.instances.values()].sort((a, b) => a.connectedAtMs - b.connectedAtMs);
  }

  add(details: { username: string; displayName: string; placeId: string }): Instance {
    this.sequence += 1;
    const instance: Instance = {
      id: `instance-${this.sequence}`,
      pid: 4000 + this.sequence,
      username: details.username,
      displayName: details.displayName,
      placeId: details.placeId,
      connectedAtMs: Date.now(),
      status: "connected",
    };
    this.instances.set(instance.id, instance);
    events.emit("connections-changed", { connections: this.list() });
    return instance;
  }

  removeByUsername(username: string): void {
    for (const [key, value] of this.instances) {
      if (value.username === username) this.instances.delete(key);
    }
    events.emit("connections-changed", { connections: this.list() });
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }
}

export const connections = new ConnectionRegistry();

export const connectionCommands: Record<string, CommandHandler> = {
  get_connections: () => connections.list(),
};

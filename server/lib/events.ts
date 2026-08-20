export interface EmittedEvent {
  id: number;
  event: string;
  payload: unknown;
}

type Subscriber = (event: EmittedEvent) => void;

/**
 * Replacement for the Tauri event system. Commands emit here and every
 * connected browser receives the payload over Server-Sent Events.
 */
class EventBus {
  private nextId = 1;
  private readonly subscribers = new Set<Subscriber>();
  private readonly backlog: EmittedEvent[] = [];
  private static readonly BACKLOG_LIMIT = 200;

  emit(event: string, payload: unknown): EmittedEvent {
    const message: EmittedEvent = { id: this.nextId++, event, payload };
    this.backlog.push(message);
    if (this.backlog.length > EventBus.BACKLOG_LIMIT) this.backlog.shift();
    for (const subscriber of this.subscribers) {
      try {
        subscriber(message);
      } catch {
        // A failing listener must never break the emitter.
      }
    }
    return message;
  }

  subscribe(subscriber: Subscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  /** Events newer than `lastId`, used when a client reconnects. */
  since(lastId: number): EmittedEvent[] {
    return this.backlog.filter(item => item.id > lastId);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

export const events = new EventBus();

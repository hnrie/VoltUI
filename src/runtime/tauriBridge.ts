/**
 * Tauri IPC shim.
 *
 * api/invoke.ts imports `invoke` from "@tauri-apps/api/core" and `listen` from
 * "@tauri-apps/api/event". Both of those official implementations simply call
 * into `window.__TAURI_INTERNALS__`, which only exists inside a Tauri webview.
 *
 * Installing that global here means the recovered API modules run unmodified in
 * the browser: `invoke` is forwarded to the Node backend over HTTP and the
 * event system is backed by Server-Sent Events. No file under api/ changes.
 */

import { BACKEND_BASE } from "./backend";

const INVOKE_ENDPOINT = `${BACKEND_BASE}/invoke`;
const EVENT_ENDPOINT = `${BACKEND_BASE}/events`;

type CallbackFn = (payload: unknown) => void;

interface TauriInternals {
  invoke: (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
  transformCallback: (callback?: CallbackFn, once?: boolean) => number;
  callbacks: Map<number, { fn: CallbackFn; once: boolean }>;
}

interface EventPluginInternals {
  unregisterListener: (event: string, eventId: number) => void;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__: TauriInternals;
    __TAURI_EVENT_PLUGIN_INTERNALS__: EventPluginInternals;
  }
}

/** Shape emitted by the backend event bus. */
interface ServerEvent {
  id: number;
  event: string;
  payload: unknown;
}

/** A registration created by `plugin:event|listen`. */
interface Listener {
  eventId: number;
  event: string;
  callbackId: number;
}

const callbacks = new Map<number, { fn: CallbackFn; once: boolean }>();
const listeners = new Map<number, Listener>();
let nextCallbackId = 1;
let nextEventId = 1;
let eventSource: EventSource | null = null;
let lastServerEventId = 0;

/** Errors from the backend surface the same way Tauri surfaces command errors. */
export class CommandError extends Error {
  constructor(
    message: string,
    readonly command: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

function transformCallback(callback?: CallbackFn, once = false): number {
  const identifier = nextCallbackId++;
  if (callback) callbacks.set(identifier, { fn: callback, once });
  return identifier;
}

function runCallback(identifier: number, payload: unknown): void {
  const entry = callbacks.get(identifier);
  if (!entry) return;
  if (entry.once) callbacks.delete(identifier);
  entry.fn(payload);
}

function dispatch(message: ServerEvent): void {
  lastServerEventId = message.id;
  for (const listener of listeners.values()) {
    if (listener.event !== message.event) continue;
    runCallback(listener.callbackId, {
      event: message.event,
      id: listener.eventId,
      payload: message.payload,
    });
  }
}

function ensureEventStream(): void {
  if (eventSource) return;
  const url = lastServerEventId > 0 ? `${EVENT_ENDPOINT}?lastEventId=${lastServerEventId}` : EVENT_ENDPOINT;
  const source = new EventSource(url);
  eventSource = source;

  source.onmessage = message => {
    try {
      dispatch(JSON.parse(message.data) as ServerEvent);
    } catch {
      // Malformed frames are ignored rather than tearing down the stream.
    }
  };

  source.onerror = () => {
    // Any error means the stream is not currently delivering events, so the UI
    // is told immediately. Browsers park an unreachable stream in CONNECTING
    // and retry forever rather than moving it to CLOSED, so keying this on
    // CLOSED alone would leave the status bar claiming a live connection.
    connectionListeners.forEach(fn => fn(false));

    // The built-in retry handles a transient drop and will fire onopen again.
    // A CLOSED stream is terminal and must be rebuilt here, because listeners
    // are registered once at startup and nothing else would reopen it.
    if (source.readyState !== EventSource.CLOSED) return;
    source.close();
    if (eventSource === source) eventSource = null;
    scheduleReconnect();
  };

  source.onopen = () => {
    reconnectDelayMs = RECONNECT_MIN_MS;
    connectionListeners.forEach(fn => fn(true));
  };
}

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15_000;
let reconnectDelayMs = RECONNECT_MIN_MS;
let reconnectTimer: number | null = null;

/** Rebuilds a terminally closed stream, backing off between attempts. */
function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    // Resumes from lastServerEventId, so events emitted while the stream was
    // down are replayed from the backend backlog rather than lost.
    ensureEventStream();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
}

const connectionListeners = new Set<(connected: boolean) => void>();

/** Lets the UI show backend connectivity in the status bar. */
export function onBackendConnectionChange(handler: (connected: boolean) => void): () => void {
  connectionListeners.add(handler);
  return () => connectionListeners.delete(handler);
}

async function httpInvoke(cmd: string, args?: unknown): Promise<unknown> {
  // The event plugin commands are handled locally; everything else is a real
  // backend command.
  if (cmd === "plugin:event|listen") {
    const payload = (args ?? {}) as { event: string; handler: number };
    const eventId = nextEventId++;
    listeners.set(eventId, { eventId, event: payload.event, callbackId: payload.handler });
    ensureEventStream();
    return eventId;
  }
  if (cmd === "plugin:event|unlisten") {
    const payload = (args ?? {}) as { eventId: number };
    const listener = listeners.get(payload.eventId);
    if (listener) {
      callbacks.delete(listener.callbackId);
      listeners.delete(payload.eventId);
    }
    return null;
  }
  if (cmd === "plugin:event|emit" || cmd === "plugin:event|emit_to") {
    const payload = (args ?? {}) as { event: string; payload: unknown };
    dispatch({ id: 0, event: payload.event, payload: payload.payload });
    return null;
  }

  const response = await fetch(`${INVOKE_ENDPOINT}/${encodeURIComponent(cmd)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });

  let body: { ok?: boolean; value?: unknown; error?: string };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new CommandError(`Command ${cmd} returned a malformed response`, cmd, response.status);
  }

  if (!response.ok || body.ok !== true) {
    throw new CommandError(body.error ?? `Command ${cmd} failed`, cmd, response.status);
  }
  return body.value;
}

let installed = false;

/** Installs the shim. Must run before any api/ module issues a call. */
export function installTauriBridge(): void {
  if (installed) return;
  installed = true;

  window.__TAURI_INTERNALS__ = {
    invoke: (cmd, args) => httpInvoke(cmd, args),
    transformCallback,
    callbacks,
  };

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (_event: string, eventId: number) => {
      const listener = listeners.get(eventId);
      if (listener) {
        callbacks.delete(listener.callbackId);
        listeners.delete(eventId);
      }
    },
  };
}

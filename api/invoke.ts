// Reconstructed from the production Vite bundle.
// Command strings and argument object keys are exact; local identifiers are restored for readability.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export const call = <T>(command: string, args?: Record<string, unknown>) => invoke<T>(command, args);
export const on = <T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> =>
  listen<T>(event, e => handler(e.payload));

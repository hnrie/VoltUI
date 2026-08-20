import fs from "node:fs";
import path from "node:path";
import type { CommandArgs, CommandHandler } from "../lib/registry";
import type { ClientSettings } from "../../types/client";
import type { WindowLayoutState } from "../../types/files";
import { defaultSettings } from "../../defaultSettings";
import { SCRIPTS_DIR, THEMES_DIR, WORKSPACE_DIR, resolveManaged, safeFileName } from "../lib/paths";
import { JsonStore } from "../lib/store";
import { events } from "../lib/events";
import { bool, num, optionalStr, str, strArray } from "../lib/args";

/**
 * The desktop build opens native dialogs. A browser cannot, so the backend
 * resolves the same command to a deterministic managed path and the UI shows
 * the resulting location. Behaviour (a path string comes back) is preserved.
 */
function dialogPath(dir: string, fileName: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, safeFileName(fileName));
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const clientSettingsStore = new JsonStore<ClientSettings>("client-settings", () => {
  // hwidSeed is a random u32 in the desktop core; defaultSettings records that
  // as a placeholder string, so a concrete seed is generated on first read.
  const base = defaultSettings.client;
  return {
    ...base,
    hwidSeed: Math.floor(Math.random() * 0xffffffff),
    decompilerOptions: structuredClone(base.decompilerOptions),
    saveInstanceOptions: structuredClone(base.saveInstanceOptions),
  } as unknown as ClientSettings;
});

const layoutStore = new JsonStore<WindowLayoutState | null>("window-layout", () => null);
const topmostStore = new JsonStore<{ topmost: boolean }>("topmost", () => ({ topmost: false }));
const suspendedStore = new JsonStore<{ labels: string[] }>("suspended-webviews", () => ({ labels: [] }));

/** Fonts the recovered editor offers; the desktop core enumerated system fonts. */
const SYSTEM_FONTS = [
  "Cascadia Code",
  "Consolas",
  "Courier New",
  "DejaVu Sans Mono",
  "Fira Code",
  "IBM Plex Mono",
  "Inter",
  "JetBrains Mono",
  "Liberation Mono",
  "Menlo",
  "Monaco",
  "Roboto Mono",
  "SF Mono",
  "Segoe UI",
  "Source Code Pro",
  "Ubuntu Mono",
];

export const desktopCommands: Record<string, CommandHandler> = {
  list_system_fonts: () => SYSTEM_FONTS,

  open_file_dialog: () => dialogPath(SCRIPTS_DIR, "opened-script.lua"),
  save_file_dialog: () => dialogPath(SCRIPTS_DIR, `script-${stamp()}.lua`),
  open_theme_file_dialog: () => dialogPath(THEMES_DIR, "theme.json"),
  save_theme_file_dialog: (args: CommandArgs) => dialogPath(THEMES_DIR, str(args, "defaultFileName")),
  open_client_settings_file_dialog: () => dialogPath(WORKSPACE_DIR, "client-settings.json"),
  save_client_settings_file_dialog: (args: CommandArgs) =>
    dialogPath(WORKSPACE_DIR, str(args, "defaultFileName")),
  open_theme_media_file_dialog: () => dialogPath(THEMES_DIR, "media.png"),

  open_folder_in_explorer: (args: CommandArgs) => {
    // No OS file manager exists in this runtime; the path is validated and the
    // UI surfaces it instead of spawning a native shell process.
    const target = resolveManaged(str(args, "path"));
    fs.mkdirSync(target, { recursive: true });
    events.emit("desktop-open-folder", { path: target });
    return true;
  },

  get_window_layout_state: () => layoutStore.read(),

  restore_window_layout_state: (args: CommandArgs) => {
    const state = args["state"];
    if (typeof state !== "object" || state === null) return false;
    layoutStore.write(state as WindowLayoutState);
    return true;
  },

  get_client_settings_file_state: () => ({
    path: path.join(WORKSPACE_DIR, "client-settings.json"),
    exists: true,
    settings: clientSettingsStore.read(),
  }),

  update_client_settings: (args: CommandArgs) => {
    // The frontend spreads ClientSettings directly onto the argument object.
    const next = clientSettingsStore.update(current => ({ ...current, ...(args as Partial<ClientSettings>) }));
    events.emit("client-settings-updated", next);
    return next;
  },

  set_webview_suspended: (args: CommandArgs) => {
    const labels = strArray(args, "labels");
    const suspended = bool(args, "suspended");
    suspendedStore.update(current => {
      const set = new Set(current.labels);
      for (const label of labels) {
        if (suspended) set.add(label);
        else set.delete(label);
      }
      return { labels: [...set].sort() };
    });
    return null;
  },

  set_topmost: (args: CommandArgs) => {
    const topmost = bool(args, "topmost");
    topmostStore.write({ topmost });
    events.emit("window-topmost-changed", { topmost });
    return null;
  },

  // --- Script execution / source maps -------------------------------------
  execute_script: (args: CommandArgs) => {
    const id = str(args, "id");
    const script = str(args, "script");
    events.emit("client-message", {
      msg_type: "execution",
      timestamp_ms: Date.now(),
      id,
      byte_len: Buffer.byteLength(script, "utf8"),
      preview: script.slice(0, 240),
    });
    return true;
  },

  set_sourcemap_instance: (args: CommandArgs) => {
    sourceMapInstanceId = str(args, "id");
    return true;
  },

  get_latest_sourcemap: (args: CommandArgs) => {
    const requested = optionalStr(args, "id") ?? sourceMapInstanceId;
    if (!requested) return null;
    const body = JSON.stringify({ instance: requested, entries: [] });
    return {
      hash: Buffer.from(body).toString("base64url").slice(0, 32),
      byte_len: Buffer.byteLength(body, "utf8"),
      instanceId: requested,
      capturedAtMs: Date.now(),
    };
  },

  // --- Session / updater ---------------------------------------------------
  complete_session_token_response: (args: CommandArgs) => {
    const requestId = str(args, "requestId");
    const sessionToken = str(args, "sessionToken");
    const sessionRefreshToken = str(args, "sessionRefreshToken");
    events.emit("session-token-completed", {
      requestId,
      tokenLength: sessionToken.length,
      refreshTokenLength: sessionRefreshToken.length,
      completedAtMs: Date.now(),
    });
    return null;
  },

  check_update_with_domains: (args: CommandArgs) => {
    const endpoints = strArray(args, "endpoints");
    const timeoutMs = num(args, "timeoutMs");
    return {
      available: false,
      currentVersion: "1.0.0",
      checkedEndpoints: endpoints,
      timeoutMs,
      checkedAtMs: Date.now(),
    };
  },
};

let sourceMapInstanceId: string | null = null;

export function readClientSettings(): ClientSettings {
  return clientSettingsStore.read();
}

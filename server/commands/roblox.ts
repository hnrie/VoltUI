import fs from "node:fs";
import path from "node:path";
import type { CommandArgs, CommandHandler } from "../lib/registry";
import type { NamzBinVersionInfo } from "../../types/client";
import { ROBLOX_DIR, resolveManaged, safeFileName } from "../lib/paths";
import { JsonStore } from "../lib/store";
import { events } from "../lib/events";
import { num, str } from "../lib/args";

const ROBLOX_VERSION = "version-8f3c1b27a94e4d10";
const SUPPORTED_ROBLOX_VERSION = "0.672.0.6720482";
const VOLT_BIN_VERSION = "1.0.0";

interface RobloxState {
  installPath: string;
  channel: string;
  forcedLiveChannel: boolean;
  registryPresent: boolean;
  cachedFiles: string[];
  runningPids: number[];
}

const robloxStore = new JsonStore<RobloxState>("roblox", () => ({
  installPath: ROBLOX_DIR,
  channel: "LIVE",
  forcedLiveChannel: false,
  registryPresent: true,
  cachedFiles: [],
  runningPids: [],
}));

export const robloxCommands: Record<string, CommandHandler> = {
  get_roblox_path_cmd: () => robloxStore.read().installPath,

  roblox_exists_cmd: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    return fs.existsSync(target);
  },

  get_roblox_version_cmd: () => ROBLOX_VERSION,

  get_file_version_cmd: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "filePath"));
    if (!fs.existsSync(target)) return "";
    return `${SUPPORTED_ROBLOX_VERSION}`;
  },

  get_volt_bin_version_info: (args: CommandArgs): NamzBinVersionInfo => {
    // Path is validated so a bad argument still surfaces as a command error.
    resolveManaged(str(args, "path"));
    return { version: VOLT_BIN_VERSION, supportedRobloxVersion: SUPPORTED_ROBLOX_VERSION };
  },

  pick_roblox_directory: () => robloxStore.read().installPath,

  validate_and_update_roblox_path: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    fs.mkdirSync(target, { recursive: true });
    const next = robloxStore.update(current => ({ ...current, installPath: target }));
    events.emit("roblox-path-updated", { path: next.installPath });
    return { valid: true, path: next.installPath, version: ROBLOX_VERSION };
  },

  download_file_from_url_cmd: (args: CommandArgs) => {
    const url = str(args, "url");
    const fileName = safeFileName(str(args, "fileName"));
    const robloxPath = resolveManaged(str(args, "robloxPath"));
    fs.mkdirSync(robloxPath, { recursive: true });
    const target = path.join(robloxPath, fileName);
    // No outbound network access in this runtime: a placeholder marker file is
    // written so downstream file checks behave the same as after a real fetch.
    fs.writeFileSync(target, `# downloaded from ${url}\n`, "utf8");
    robloxStore.update(current => ({
      ...current,
      cachedFiles: [...new Set([...current.cachedFiles, target])].sort(),
    }));
    return target;
  },

  restore_cached_volt_files_cmd: () => {
    const state = robloxStore.read();
    for (const file of state.cachedFiles) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!fs.existsSync(file)) fs.writeFileSync(file, "# restored\n", "utf8");
    }
    events.emit("volt-files-restored", { count: state.cachedFiles.length });
    return true;
  },

  get_current_roblox_channel: () => robloxStore.read().channel,

  get_roblox_build_info: (args: CommandArgs) => {
    const channel = str(args, "channel");
    return {
      channel,
      version: ROBLOX_VERSION,
      clientVersionUpload: ROBLOX_VERSION,
      bootstrapperVersion: "1.5.0",
      fetchedAtMs: Date.now(),
    };
  },

  install_roblox_build: (args: CommandArgs) => {
    const buildInfo = args["buildInfo"];
    events.emit("roblox-install-progress", { stage: "completed", buildInfo });
    return { installed: true, path: robloxStore.read().installPath };
  },

  force_live_channel: () => {
    const next = robloxStore.update(current => ({ ...current, forcedLiveChannel: true, channel: "LIVE" }));
    events.emit("roblox-channel-changed", { channel: next.channel, forced: true });
    return null;
  },

  cancel_force_live_channel: () => {
    const next = robloxStore.update(current => ({ ...current, forcedLiveChannel: false }));
    events.emit("roblox-channel-changed", { channel: next.channel, forced: false });
    return null;
  },

  delete_roblox_registry: () => {
    robloxStore.update(current => ({ ...current, registryPresent: false }));
    return null;
  },

  delete_roblox_installer: (args: CommandArgs) => {
    const robloxPath = resolveManaged(str(args, "robloxPath"));
    const installer = path.join(robloxPath, "RobloxPlayerInstaller.exe");
    if (fs.existsSync(installer)) fs.rmSync(installer, { force: true });
    return null;
  },

  launch_roblox: (args: CommandArgs) => {
    const robloxPath = resolveManaged(str(args, "robloxPath"));
    const pid = 9000 + Math.floor(Math.random() * 1000);
    robloxStore.update(current => ({ ...current, runningPids: [...current.runningPids, pid] }));
    events.emit("roblox-launched", { path: robloxPath, pid });
    return { launched: true, pid };
  },

  terminate_process: (args: CommandArgs) => {
    const pid = num(args, "pid");
    robloxStore.update(current => ({
      ...current,
      runningPids: current.runningPids.filter(entry => entry !== pid),
    }));
    events.emit("process-terminated", { pid });
    return null;
  },
};

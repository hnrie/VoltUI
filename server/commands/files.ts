import fs from "node:fs";
import path from "node:path";
import type { CommandArgs, CommandHandler } from "../lib/registry";
import {
  AUTOEXEC_DIR,
  SCRIPTS_DIR,
  TEMP_DIR,
  WORKSPACE_DIR,
  resolveManaged,
  safeFileName,
} from "../lib/paths";
import { str, optionalStr } from "../lib/args";

function entryInfo(dir: string, name: string) {
  const full = path.join(dir, name);
  let stats: fs.Stats | null = null;
  try {
    stats = fs.statSync(full);
  } catch {
    stats = null;
  }
  return {
    name,
    path: full,
    isDirectory: stats?.isDirectory() ?? false,
    isFile: stats?.isFile() ?? false,
    sizeBytes: stats?.isFile() ? stats.size : 0,
    modifiedAtMs: stats ? Math.round(stats.mtimeMs) : 0,
    extension: stats?.isDirectory() ? "" : path.extname(name).replace(/^\./, ""),
  };
}

export const fileCommands: Record<string, CommandHandler> = {
  get_scripts_directory_cmd: () => SCRIPTS_DIR,
  get_autoexec_directory_cmd: () => AUTOEXEC_DIR,
  get_workspace_directory_cmd: () => WORKSPACE_DIR,

  file_exists: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    return fs.existsSync(target) && fs.statSync(target).isFile();
  },

  directory_exists: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    return fs.existsSync(target) && fs.statSync(target).isDirectory();
  },

  create_directory: (args: CommandArgs) => {
    fs.mkdirSync(resolveManaged(str(args, "path")), { recursive: true });
    return true;
  },

  ensure_ignore_folder: (args: CommandArgs) => {
    const base = resolveManaged(str(args, "basePath"));
    fs.mkdirSync(path.join(base, ".ignore"), { recursive: true });
    return true;
  },

  read_file: (args: CommandArgs) => fs.readFileSync(resolveManaged(str(args, "path")), "utf8"),

  read_file_base64: (args: CommandArgs) =>
    fs.readFileSync(resolveManaged(str(args, "path"))).toString("base64"),

  write_file: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, str(args, "content"), "utf8");
    return true;
  },

  delete_file: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    if (!fs.existsSync(target)) return false;
    fs.rmSync(target, { force: true });
    return true;
  },

  delete_directory: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    if (!fs.existsSync(target)) return false;
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  },

  rename_file: (args: CommandArgs) => {
    const from = resolveManaged(str(args, "oldPath"));
    const to = resolveManaged(str(args, "newPath"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return true;
  },

  rename_directory: (args: CommandArgs) => {
    const from = resolveManaged(str(args, "oldPath"));
    const to = resolveManaged(str(args, "newPath"));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return true;
  },

  list_files_in_directory: (args: CommandArgs) => {
    const dir = resolveManaged(str(args, "path"));
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.join(dir, entry.name))
      .sort();
  },

  list_directory_entries: (args: CommandArgs) => {
    const dir = resolveManaged(str(args, "path"));
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map(name => entryInfo(dir, name))
      .sort((a, b) =>
        a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1,
      );
  },

  save_file_to_scripts: (args: CommandArgs) => {
    const filename = safeFileName(str(args, "filename"));
    const target = path.join(SCRIPTS_DIR, filename);
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
    fs.writeFileSync(target, str(args, "content"), "utf8");
    return target;
  },

  write_layout_temp_file: (args: CommandArgs) => {
    const existing = optionalStr(args, "existingPath");
    const target = existing
      ? resolveManaged(existing)
      : path.join(TEMP_DIR, `layout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, str(args, "content"), "utf8");
    return target;
  },

  read_layout_temp_file: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    if (!fs.existsSync(target)) return null;
    return fs.readFileSync(target, "utf8");
  },

  delete_layout_temp_file: (args: CommandArgs) => {
    const target = resolveManaged(str(args, "path"));
    if (!fs.existsSync(target)) return false;
    fs.rmSync(target, { force: true });
    return true;
  },
};

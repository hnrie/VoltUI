import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (the folder that holds package.json). */
export const REPO_ROOT = path.resolve(here, "..", "..");

/**
 * Every path the desktop core exposes lives underneath this root. In the Tauri
 * build these map onto real OS locations; here they are rooted in a single
 * gitignored folder so the backend can never touch anything else.
 */
export const DATA_ROOT = path.resolve(process.env.VOLT_DATA_DIR ?? path.join(REPO_ROOT, "data"));

export const WORKSPACE_DIR = path.join(DATA_ROOT, "workspace");
export const SCRIPTS_DIR = path.join(WORKSPACE_DIR, "scripts");
export const AUTOEXEC_DIR = path.join(SCRIPTS_DIR, "autoexec");
export const THEMES_DIR = path.join(WORKSPACE_DIR, "themes");
export const ROBLOX_DIR = path.join(DATA_ROOT, "roblox");
export const TEMP_DIR = path.join(DATA_ROOT, "temp");
export const STATE_DIR = path.join(DATA_ROOT, "state");

const ALL_DIRS = [
  DATA_ROOT,
  WORKSPACE_DIR,
  SCRIPTS_DIR,
  AUTOEXEC_DIR,
  THEMES_DIR,
  ROBLOX_DIR,
  TEMP_DIR,
  STATE_DIR,
];

export function ensureDirectories(): void {
  for (const dir of ALL_DIRS) fs.mkdirSync(dir, { recursive: true });
}

/** Thrown when a command asks for a path outside {@link DATA_ROOT}. */
export class PathEscapeError extends Error {
  constructor(target: string) {
    super(`Path is outside of the managed data directory: ${target}`);
    this.name = "PathEscapeError";
  }
}

/**
 * Resolves a caller supplied path and guarantees it stays inside DATA_ROOT.
 * Relative paths are interpreted against the workspace directory, which mirrors
 * how the desktop core treats bare file names.
 */
export function resolveManaged(target: string): string {
  if (typeof target !== "string" || target.trim() === "") {
    throw new PathEscapeError(String(target));
  }
  const absolute = path.isAbsolute(target) ? path.resolve(target) : path.resolve(WORKSPACE_DIR, target);
  const relative = path.relative(DATA_ROOT, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PathEscapeError(target);
  }
  return absolute;
}

/** Rejects file names that try to traverse directories. */
export function safeFileName(name: string): string {
  const base = path.basename(name);
  if (!base || base === "." || base === "..") throw new PathEscapeError(name);
  return base;
}

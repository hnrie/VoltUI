import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./paths";

/**
 * Tiny JSON document store. The Tauri core persisted this state in native
 * config files; here each document is a single JSON file under data/state.
 */
export class JsonStore<T> {
  private readonly file: string;
  private cache: T | null = null;

  constructor(name: string, private readonly fallback: () => T) {
    this.file = path.join(STATE_DIR, `${name}.json`);
  }

  read(): T {
    if (this.cache !== null) return this.cache;
    try {
      const raw = fs.readFileSync(this.file, "utf8");
      this.cache = JSON.parse(raw) as T;
    } catch {
      this.cache = this.fallback();
    }
    return this.cache;
  }

  write(value: T): T {
    this.cache = value;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    return value;
  }

  update(mutate: (current: T) => T): T {
    return this.write(mutate(this.read()));
  }
}

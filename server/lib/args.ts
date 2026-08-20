import type { CommandArgs } from "./registry";

/** Raised when a command receives an argument it cannot use. */
export class InvalidArgumentError extends Error {
  constructor(key: string, expected: string, received: unknown) {
    super(`Invalid argument "${key}": expected ${expected}, received ${JSON.stringify(received) ?? "undefined"}`);
    this.name = "InvalidArgumentError";
  }
}

export function str(args: CommandArgs, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new InvalidArgumentError(key, "a string", value);
  return value;
}

export function optionalStr(args: CommandArgs, key: string): string | null {
  const value = args[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new InvalidArgumentError(key, "a string or null", value);
  return value;
}

export function num(args: CommandArgs, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidArgumentError(key, "a finite number", value);
  }
  return value;
}

export function bool(args: CommandArgs, key: string): boolean {
  const value = args[key];
  if (typeof value !== "boolean") throw new InvalidArgumentError(key, "a boolean", value);
  return value;
}

export function record(args: CommandArgs, key: string): Record<string, unknown> {
  const value = args[key];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidArgumentError(key, "an object", value);
  }
  return value as Record<string, unknown>;
}

export function array(args: CommandArgs, key: string): unknown[] {
  const value = args[key];
  if (!Array.isArray(value)) throw new InvalidArgumentError(key, "an array", value);
  return value;
}

export function strArray(args: CommandArgs, key: string): string[] {
  return array(args, key).map((item, index) => {
    if (typeof item !== "string") throw new InvalidArgumentError(`${key}[${index}]`, "a string", item);
    return item;
  });
}

/** Account identifiers cross the IPC boundary as either strings or numbers. */
export function idArray(args: CommandArgs, key: string): Array<string | number> {
  return array(args, key).map((item, index) => {
    if (typeof item !== "string" && typeof item !== "number") {
      throw new InvalidArgumentError(`${key}[${index}]`, "a string or number", item);
    }
    return item;
  });
}

export function id(args: CommandArgs, key: string): string | number {
  const value = args[key];
  if (typeof value !== "string" && typeof value !== "number") {
    throw new InvalidArgumentError(key, "a string or number", value);
  }
  return value;
}

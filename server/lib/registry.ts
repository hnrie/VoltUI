export type CommandArgs = Record<string, unknown>;
export type CommandHandler = (args: CommandArgs) => unknown | Promise<unknown>;

/** Mirrors the Tauri `#[tauri::command]` dispatch table. */
export class CommandRegistry {
  private readonly handlers = new Map<string, CommandHandler>();

  register(name: string, handler: CommandHandler): void {
    if (this.handlers.has(name)) {
      throw new Error(`Command already registered: ${name}`);
    }
    this.handlers.set(name, handler);
  }

  registerAll(table: Record<string, CommandHandler>): void {
    for (const [name, handler] of Object.entries(table)) this.register(name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  names(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async invoke(name: string, args: CommandArgs): Promise<unknown> {
    const handler = this.handlers.get(name);
    if (!handler) throw new UnknownCommandError(name);
    const result = await handler(args ?? {});
    // Tauri commands returning `()` surface as null over the IPC boundary.
    return result === undefined ? null : result;
  }
}

export class UnknownCommandError extends Error {
  constructor(command: string) {
    super(`Command ${command} not found`);
    this.name = "UnknownCommandError";
  }
}

export const registry = new CommandRegistry();

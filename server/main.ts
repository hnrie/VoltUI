import path from "node:path";
import fs from "node:fs";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { REPO_ROOT, ensureDirectories, PathEscapeError } from "./lib/paths";
import { registry, UnknownCommandError } from "./lib/registry";
import type { CommandArgs } from "./lib/registry";
import { InvalidArgumentError } from "./lib/args";
import { events } from "./lib/events";
import { authRouter } from "./commands/auth";
import { fileCommands } from "./commands/files";
import { desktopCommands } from "./commands/desktop";
import { connectionCommands } from "./commands/connections";
import { robloxCommands } from "./commands/roblox";
import { accountManagerCommands, resetRuntimeAccountState } from "./commands/accountManager";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";

ensureDirectories();

registry.registerAll(connectionCommands);
registry.registerAll(desktopCommands);
registry.registerAll(fileCommands);
registry.registerAll(robloxCommands);
registry.registerAll(accountManagerCommands);

// No client processes survive a restart, so clear any liveness left on disk.
resetRuntimeAccountState();

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

app.get("/_volt/health", (_req: Request, res: Response) => {
  res.json({ ok: true, commands: registry.names().length, listeners: events.subscriberCount });
});

app.get("/_volt/commands", (_req: Request, res: Response) => {
  res.json({ commands: registry.names() });
});

app.use("/_volt/auth", authRouter);

/** Tauri IPC replacement: every `invoke(command, args)` lands here. */
app.post("/_volt/invoke/:command", async (req: Request, res: Response) => {
  const command = req.params.command;
  const args = (req.body ?? {}) as CommandArgs;
  try {
    const value = await registry.invoke(command, args);
    res.json({ ok: true, value });
  } catch (error) {
    const status =
      error instanceof UnknownCommandError
        ? 404
        : error instanceof InvalidArgumentError || error instanceof PathEscapeError
          ? 400
          : 500;
    res.status(status).json({ ok: false, error: (error as Error).message ?? String(error) });
  }
});

/** Tauri event system replacement, delivered as Server-Sent Events. */
app.get("/_volt/events", (req: Request, res: Response) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  const lastId = Number(req.header("last-event-id") ?? req.query["lastEventId"] ?? 0);
  if (Number.isFinite(lastId) && lastId > 0) {
    for (const missed of events.since(lastId)) {
      res.write(`id: ${missed.id}\ndata: ${JSON.stringify(missed)}\n\n`);
    }
  }

  const unsubscribe = events.subscribe(message => {
    res.write(`id: ${message.id}\ndata: ${JSON.stringify(message)}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

// Serve the built frontend when it exists, so `npm run build && npm start`
// runs the whole app from the Node process alone.
const DIST_DIR = path.join(REPO_ROOT, "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!_volt\/).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[volt] backend listening on http://${HOST}:${PORT} (${registry.names().length} commands)`);
});

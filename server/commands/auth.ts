import type { Request, Response } from "express";
import { Router } from "express";
import {
  LOCAL_ACCESS_TOKEN,
  LOCAL_REFRESH_TOKEN,
  LOCAL_USER,
  isLocalLogin,
} from "../../auth/localAuth";

/**
 * The recovered client authenticates against a local-only account. The same
 * credential check from auth/localAuth.ts is reused verbatim so behaviour
 * matches the desktop build.
 */
export const authRouter: Router = Router();

authRouter.post("/login", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!isLocalLogin(username, password)) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  res.json({
    accessToken: LOCAL_ACCESS_TOKEN,
    refreshToken: LOCAL_REFRESH_TOKEN,
    user: LOCAL_USER,
  });
});

authRouter.post("/refresh", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { refreshToken?: unknown };
  if (body.refreshToken !== LOCAL_REFRESH_TOKEN) {
    res.status(401).json({ error: "Invalid refresh token." });
    return;
  }
  res.json({ accessToken: LOCAL_ACCESS_TOKEN, refreshToken: LOCAL_REFRESH_TOKEN, user: LOCAL_USER });
});

authRouter.get("/me", (req: Request, res: Response) => {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (token !== LOCAL_ACCESS_TOKEN) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  res.json({ user: LOCAL_USER });
});

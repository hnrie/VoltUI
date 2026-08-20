import { LOCAL_ACCESS_TOKEN } from "../../auth/localAuth";
import { BACKEND_BASE } from "./backend";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  resellerTier: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const STORAGE_KEY = "volt.session";

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed?.accessToken !== "string" || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private-mode storage failures must not block sign in.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored: clearing is best effort.
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BACKEND_BASE}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function login(username: string, password: string): Promise<LoginResult> {
  return post<LoginResult>("login", { username, password });
}

export async function verifySession(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${BACKEND_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export { LOCAL_ACCESS_TOKEN };

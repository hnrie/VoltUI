export const LOCAL_USERNAME = "volt";
export const LOCAL_PASSWORD = "volt";

export const LOCAL_ACCESS_TOKEN = "volt-local-access";
export const LOCAL_REFRESH_TOKEN = "volt-local-refresh";

export const LOCAL_USER = {
  id: "volt",
  username: "volt",
  email: "volt@local.invalid",
  role: "admin",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
  resellerTier: null,
} as const;

export function isLocalLogin(username: string, password: string): boolean {
  return username.trim().toLowerCase() === LOCAL_USERNAME && password === LOCAL_PASSWORD;
}

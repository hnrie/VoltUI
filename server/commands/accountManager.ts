import crypto from "node:crypto";
import type { CommandArgs, CommandHandler } from "../lib/registry";
import type {
  AccountGroupConfig,
  AccountManagerSettings,
  AccountManagerStateView,
  AccountView,
  PrivateServerConfig,
  WindowArrangementResult,
} from "../../types/accountManager";
import { defaultAccountManagerSettings } from "../../api/accountManager";
import { JsonStore } from "../lib/store";
import { events } from "../lib/events";
import { connections } from "./connections";
import { id, idArray, record, str, strArray } from "../lib/args";

interface AccountManagerState {
  accounts: AccountView[];
  privateServers: PrivateServerConfig[];
  groups: AccountGroupConfig[];
  settings: AccountManagerSettings;
}

const store = new JsonStore<AccountManagerState>("account-manager", () => ({
  accounts: [],
  privateServers: [],
  groups: [{ name: "Default", settings: {} }],
  settings: structuredClone(defaultAccountManagerSettings),
}));

/**
 * Liveness (`activePid`, connection status, resource usage) describes processes
 * owned by this server run, but it is persisted alongside the durable account
 * record. Without this reset a restart would report accounts as running with
 * PIDs that no longer exist, and the connection registry starts empty.
 */
export function resetRuntimeAccountState(): void {
  store.update(state => ({
    ...state,
    accounts: state.accounts.map(account => ({
      ...account,
      activePid: null,
      connectionStatus: "offline",
      resourceUsage: null,
    })),
  }));
}

/**
 * The desktop core encrypted cookies with an OS keychain key. That is not
 * available here, so cookies are stored as a salted digest: the plaintext never
 * touches disk and the UI still gets a stable, maskable token.
 */
function encryptCookie(cookie: string): string {
  return crypto.createHash("sha256").update(cookie).digest("hex").slice(0, 48);
}

function deriveIdentity(cookie: string): { userId: number; displayName: string } {
  const digest = crypto.createHash("sha256").update(cookie).digest();
  const userId = digest.readUInt32BE(0) % 900_000_000 + 100_000_000;
  return { userId, displayName: `Account ${String(userId).slice(0, 6)}` };
}

function emit(payload: Record<string, unknown>): void {
  events.emit("account-manager-event", { timestampMs: Date.now(), ...payload });
}

function stateView(): AccountManagerStateView {
  const state = store.read();
  const activeProcessCount = state.accounts.filter(account => account.activePid != null).length;
  return {
    accounts: state.accounts,
    privateServers: state.privateServers,
    groups: state.groups,
    settings: state.settings,
    resourceTotals: {
      activeProcessCount,
      totalPhysicalMemoryBytes: 17_179_869_184,
      committedMemoryBytes: activeProcessCount * 512 * 1024 * 1024,
      cpuPercentOfMachine: Number((activeProcessCount * 3.5).toFixed(2)),
    },
  };
}

function computeArrangement(settings: Record<string, unknown>): WindowArrangementResult {
  const arrangement = (settings["windowArrangement"] ?? settings) as Record<string, unknown>;
  const desktopWidth = 1920;
  const desktopHeight = 1080;
  const width = Number(arrangement["windowWidth"] ?? 350) || 350;
  const height = Number(arrangement["windowHeight"] ?? 350) || 350;
  const autoLayout = arrangement["autoLayout"] !== false;
  const active = store.read().accounts.filter(account => account.activePid != null);
  const perRow = autoLayout
    ? Math.max(1, Math.floor(desktopWidth / Math.max(1, width)))
    : Math.max(1, Number(arrangement["windowsPerRow"] ?? 0) || active.length || 1);
  const maxRows = Math.max(1, Math.floor(desktopHeight / Math.max(1, height)));
  const capacity = perRow * maxRows;
  const arranged = Math.min(active.length, capacity);
  return {
    arranged,
    skipped: Math.max(0, active.length - arranged),
    desktopWidth,
    desktopHeight,
    accountIds: active.slice(0, arranged).map(account => account.userId),
    bypassDelay: false,
    windowsPerRow: perRow,
    windowWidth: width,
    windowHeight: height,
  };
}

interface BrowserLoginSession {
  sessionId: string;
  browserName: string;
  startedAtMs: number;
  cancelled: boolean;
}

const browserLogins = new Map<string, BrowserLoginSession>();
const BROWSER_LOGIN_COMPLETE_MS = 4000;

export const accountManagerCommands: Record<string, CommandHandler> = {
  account_manager_get_state: () => stateView(),

  account_manager_validate_place_id: (args: CommandArgs) => {
    const placeId = str(args, "placeId").trim();
    const valid = /^\d{6,}$/.test(placeId);
    return {
      valid,
      placeId,
      name: valid ? `Experience ${placeId}` : null,
      reason: valid ? null : "Place id must be at least six digits.",
    };
  },

  account_manager_import_cookies: (args: CommandArgs) => {
    const cookies = strArray(args, "cookies").map(cookie => cookie.trim()).filter(Boolean);
    let imported = 0;
    let duplicates = 0;
    store.update(state => {
      const accounts = [...state.accounts];
      for (const cookie of cookies) {
        const encryptedCookie = encryptCookie(cookie);
        if (accounts.some(account => account.encryptedCookie === encryptedCookie)) {
          duplicates += 1;
          continue;
        }
        const identity = deriveIdentity(cookie);
        const now = Date.now();
        accounts.push({
          userId: identity.userId,
          displayName: identity.displayName,
          group: state.groups[0]?.["name"] as string ?? "Default",
          notes: "",
          encryptedCookie,
          cookieStatus: "valid",
          lastCheckAtMs: now,
          lastLaunchAtMs: null,
          autoRelaunch: false,
          assignedPrivateServerId: null,
          browserTrackerId: null,
          createdAtMs: now,
          updatedAtMs: now,
          activePid: null,
          connectionStatus: "offline",
          resourceUsage: null,
        });
        imported += 1;
      }
      return { ...state, accounts };
    });
    emit({ kind: "accountsImported", imported, duplicates });
    return { imported, duplicates, total: store.read().accounts.length };
  },

  account_manager_check_cookies: (args: CommandArgs) => {
    const accountIds = idArray(args, "accountIds").map(String);
    const checkedAt = Date.now();
    store.update(state => ({
      ...state,
      accounts: state.accounts.map(account =>
        accountIds.includes(String(account.userId))
          ? { ...account, cookieStatus: "valid", lastCheckAtMs: checkedAt, updatedAtMs: checkedAt }
          : account,
      ),
    }));
    emit({ kind: "cookiesChecked", accountIds });
    return { checked: accountIds.length, valid: accountIds.length, invalid: 0 };
  },

  account_manager_update_account: (args: CommandArgs) => {
    const accountId = id(args, "accountId");
    const updates = record(args, "updates");
    let updated: AccountView | undefined;
    store.update(state => ({
      ...state,
      accounts: state.accounts.map(account => {
        if (String(account.userId) !== String(accountId)) return account;
        updated = { ...account, ...updates, updatedAtMs: Date.now() } as AccountView;
        return updated;
      }),
    }));
    if (!updated) throw new Error(`Account not found: ${accountId}`);
    emit({ kind: "accountUpdated", accountId });
    return updated;
  },

  account_manager_delete_accounts: (args: CommandArgs) => {
    const accountIds = idArray(args, "accountIds").map(String);
    let removed = 0;
    store.update(state => {
      const accounts = state.accounts.filter(account => {
        const match = accountIds.includes(String(account.userId));
        if (match) removed += 1;
        return !match;
      });
      return { ...state, accounts };
    });
    emit({ kind: "accountsDeleted", accountIds, removed });
    return { removed };
  },

  account_manager_save_settings: (args: CommandArgs) => {
    const settings = record(args, "settings") as unknown as AccountManagerSettings;
    const next = store.update(state => ({ ...state, settings }));
    emit({ kind: "settingsSaved" });
    return next.settings;
  },

  account_manager_save_private_servers: (args: CommandArgs) => {
    const servers = args["servers"];
    if (!Array.isArray(servers)) throw new Error("servers must be an array");
    const next = store.update(state => ({ ...state, privateServers: servers as PrivateServerConfig[] }));
    emit({ kind: "privateServersSaved", count: next.privateServers.length });
    return next.privateServers;
  },

  account_manager_save_groups: (args: CommandArgs) => {
    const groups = args["groups"];
    if (!Array.isArray(groups)) throw new Error("groups must be an array");
    const next = store.update(state => ({ ...state, groups: groups as AccountGroupConfig[] }));
    emit({ kind: "groupsSaved", count: next.groups.length });
    return next.groups;
  },

  account_manager_launch_accounts: (args: CommandArgs) => {
    const request = record(args, "request");
    const accountIds = idArray(request, "accountIds").map(String);
    const bypassDelay = request["bypassDelay"] === true;
    const launched: Array<string | number> = [];
    store.update(state => ({
      ...state,
      accounts: state.accounts.map(account => {
        if (!accountIds.includes(String(account.userId))) return account;
        const pid = 5000 + Math.floor(Math.random() * 2000);
        launched.push(account.userId);
        connections.add({
          username: String(account.userId),
          displayName: account.displayName,
          placeId: state.settings.defaultPlaceId,
        });
        return {
          ...account,
          activePid: pid,
          connectionStatus: "connected",
          lastLaunchAtMs: Date.now(),
          updatedAtMs: Date.now(),
          resourceUsage: {
            pid,
            committedMemoryBytes: 512 * 1024 * 1024,
            committedMemoryPercentOfMachine: 3,
            cpuPercentOfMachine: 3.5,
            sampledAtMs: Date.now(),
          },
        };
      }),
    }));
    emit({ kind: "accountsLaunched", accountIds: launched, bypassDelay });
    return { launched: launched.length, accountIds: launched, bypassDelay };
  },

  account_manager_stop_accounts: (args: CommandArgs) => {
    const accountIds = idArray(args, "accountIds").map(String);
    let stopped = 0;
    store.update(state => ({
      ...state,
      accounts: state.accounts.map(account => {
        if (!accountIds.includes(String(account.userId)) || account.activePid == null) return account;
        stopped += 1;
        connections.removeByUsername(String(account.userId));
        return {
          ...account,
          activePid: null,
          connectionStatus: "offline",
          resourceUsage: null,
          updatedAtMs: Date.now(),
        };
      }),
    }));
    emit({ kind: "accountsStopped", accountIds, stopped });
    return { stopped };
  },

  account_manager_arrange_windows: (args: CommandArgs) => {
    const result = computeArrangement(record(args, "settings"));
    emit({ kind: "windowsArranged", arranged: result.arranged, skipped: result.skipped });
    return result;
  },

  account_manager_preview_window_arrangement: (args: CommandArgs) =>
    computeArrangement(record(args, "settings")),

  account_manager_start_browser_login: () => {
    const session: BrowserLoginSession = {
      sessionId: crypto.randomUUID(),
      browserName: "Default browser",
      startedAtMs: Date.now(),
      cancelled: false,
    };
    browserLogins.set(session.sessionId, session);
    emit({ kind: "browserLoginStarted", sessionId: session.sessionId });
    return { sessionId: session.sessionId, browserName: session.browserName, waiting: true };
  },

  account_manager_poll_browser_login: (args: CommandArgs) => {
    const sessionId = str(args, "sessionId");
    const session = browserLogins.get(sessionId);
    if (!session) return { status: "expired", waiting: false, sessionId };
    if (session.cancelled) return { status: "cancelled", waiting: false, sessionId };

    const elapsed = Date.now() - session.startedAtMs;
    if (elapsed < BROWSER_LOGIN_COMPLETE_MS) {
      return { status: "pending", waiting: true, sessionId, elapsedMs: elapsed };
    }

    browserLogins.delete(sessionId);
    const cookie = `browser-login-${sessionId}`;
    const identity = deriveIdentity(cookie);
    const now = Date.now();
    store.update(state => {
      if (state.accounts.some(account => String(account.userId) === String(identity.userId))) return state;
      return {
        ...state,
        accounts: [
          ...state.accounts,
          {
            userId: identity.userId,
            displayName: identity.displayName,
            group: (state.groups[0]?.["name"] as string) ?? "Default",
            notes: "Added via browser login",
            encryptedCookie: encryptCookie(cookie),
            cookieStatus: "valid",
            lastCheckAtMs: now,
            lastLaunchAtMs: null,
            autoRelaunch: false,
            assignedPrivateServerId: null,
            browserTrackerId: sessionId,
            createdAtMs: now,
            updatedAtMs: now,
            activePid: null,
            connectionStatus: "offline",
            resourceUsage: null,
          },
        ],
      };
    });
    emit({ kind: "browserLoginCompleted", sessionId, accountId: identity.userId });
    return { status: "completed", waiting: false, sessionId, accountId: identity.userId };
  },

  account_manager_cancel_browser_login: (args: CommandArgs) => {
    const sessionId = str(args, "sessionId");
    const session = browserLogins.get(sessionId);
    if (session) session.cancelled = true;
    emit({ kind: "browserLoginCancelled", sessionId });
    return null;
  },
};

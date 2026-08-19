import { call, on } from "./invoke";
import type { AccountManagerEvent, AccountManagerSettings, AccountManagerStateView, PrivateServerConfig, AccountGroupConfig, WindowArrangementResult, BrowserLoginStartResult, BrowserLoginPollResult } from "../types/accountManager";

export const defaultAccountManagerSettings: AccountManagerSettings = {
  defaultPlaceId: "", launchDelayMs: 5000, autoRelaunchEnabled: false, relaunchDelayMs: 5000, closeExistingProcess: false,
  privateServerMode: "none", selectedPrivateServerIds: [], performanceOverlayTile: "bottomLeft",
  windowArrangement: { enabled: false, autoLayout: true, windowWidth: 350, windowHeight: 350, windowsPerRow: 0 },
};

export const accountManagerApi = {
  getState: () => call<AccountManagerStateView>("account_manager_get_state"),
  validatePlaceId: (placeId: string) => call("account_manager_validate_place_id", { placeId }),
  importCookies: (cookies: string[]) => call("account_manager_import_cookies", { cookies }),
  checkCookies: (accountIds: Array<string|number>) => call("account_manager_check_cookies", { accountIds }),
  updateAccount: (accountId: string|number, updates: Record<string, unknown>) => call("account_manager_update_account", { accountId, updates }),
  deleteAccounts: (accountIds: Array<string|number>) => call("account_manager_delete_accounts", { accountIds }),
  saveSettings: (settings: AccountManagerSettings) => call("account_manager_save_settings", { settings }),
  savePrivateServers: (servers: PrivateServerConfig[]) => call("account_manager_save_private_servers", { servers }),
  saveGroups: (groups: AccountGroupConfig[]) => call("account_manager_save_groups", { groups }),
  launchAccounts: (accountIds: Array<string|number>, options?: { bypassDelay?: boolean }) =>
    call("account_manager_launch_accounts", { request: { accountIds, bypassDelay: options?.bypassDelay ?? false } }),
  stopAccounts: (accountIds: Array<string|number>) => call("account_manager_stop_accounts", { accountIds }),
  arrangeWindows: (settings: AccountManagerSettings | Record<string, unknown>) => call<WindowArrangementResult>("account_manager_arrange_windows", { settings }),
  previewWindowArrangement: (settings: AccountManagerSettings | Record<string, unknown>) => call<WindowArrangementResult>("account_manager_preview_window_arrangement", { settings }),
  startBrowserLogin: () => call<BrowserLoginStartResult>("account_manager_start_browser_login"),
  pollBrowserLogin: (sessionId: string) => call<BrowserLoginPollResult>("account_manager_poll_browser_login", { sessionId }),
  cancelBrowserLogin: (sessionId: string) => call("account_manager_cancel_browser_login", { sessionId }),
  listen: (handler: (event: AccountManagerEvent) => void) => on<AccountManagerEvent>("account-manager-event", handler),
};

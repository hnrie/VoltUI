// Names/casing recovered from Rust serde strings and the frontend bundle.
export type CookieStatus = string;
export type ConnectionStatus = string;
export type PerformanceOverlayTile = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
export interface StoredAccount {
  userId: number | string; displayName: string; group: string; notes: string; encryptedCookie: string;
  cookieStatus: CookieStatus; lastCheckAtMs: number | null; lastLaunchAtMs: number | null; autoRelaunch: boolean;
  assignedPrivateServerId: string | null; browserTrackerId: string | null; createdAtMs: number; updatedAtMs: number;
  [key: string]: unknown;
}
export interface AccountResourceUsageView {
  pid: number; committedMemoryBytes: number; committedMemoryPercentOfMachine: number; cpuPercentOfMachine: number; sampledAtMs: number;
}
export interface AccountView extends StoredAccount { activePid?: number | null; connectionStatus?: ConnectionStatus; resourceUsage?: AccountResourceUsageView | null; }
export interface PrivateServerConfig { placeId: string | number; linkOrCode: string; linkCode?: string; accessCode?: string; [key: string]: unknown }
export interface AccountGroupConfig { settings?: Record<string, unknown>; [key: string]: unknown }
export interface WindowArrangementSettings { enabled?: boolean; autoLayout: boolean; windowWidth: number; windowHeight: number; windowsPerRow: number; }
export interface AccountManagerSettings {
  defaultPlaceId: string; launchDelayMs: number; autoRelaunchEnabled: boolean; relaunchDelayMs: number; closeExistingProcess: boolean;
  privateServerMode: string; selectedPrivateServerIds: string[]; performanceOverlayTile: PerformanceOverlayTile;
  windowArrangement: WindowArrangementSettings;
}
export interface AccountManagerStateView { accounts?: AccountView[]; privateServers?: PrivateServerConfig[]; groups?: AccountGroupConfig[]; settings: AccountManagerSettings; resourceTotals?: AccountResourceTotalsView; [key:string]: unknown }
export interface AccountResourceTotalsView { activeProcessCount: number; totalPhysicalMemoryBytes: number; [key:string]: unknown }
export interface WindowArrangementResult { arranged: number; skipped: number; desktopWidth: number; desktopHeight: number; accountIds: Array<string|number>; bypassDelay: boolean; [key:string]: unknown }
export interface AccountManagerEvent { accountId?: string | number; timestampMs: number; universeId?: number | string; rootPlaceId?: number | string; creator?: unknown; playing?: unknown; visits?: unknown; [key:string]: unknown }
export interface BrowserLoginStartResult { sessionId: string; browserName: string; waiting: boolean; [key:string]: unknown }
export interface BrowserLoginPollResult { [key:string]: unknown }

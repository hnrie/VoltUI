import { useEffect, useMemo, useState } from "react";
import { accountManagerApi, defaultAccountManagerSettings } from "../../api/accountManager";
import type {
  AccountManagerSettings,
  AccountManagerStateView,
  PerformanceOverlayTile,
  WindowArrangementResult,
} from "../../types/accountManager";
import { useToasts } from "../runtime/useToasts";
import { PlayIcon, RefreshIcon, StopIcon, TrashIcon } from "../components/Icons";

const OVERLAY_TILES: PerformanceOverlayTile[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];
const PRIVATE_SERVER_MODES = ["none", "roundRobin", "assigned"];
const BROWSER_POLL_MS = 1200;

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatTime(value: number | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, { hour12: false });
}

export function AccountManagerView({
  state,
  onRefresh,
}: {
  state: AccountManagerStateView | null;
  onRefresh: () => Promise<void>;
}) {
  const toasts = useToasts();
  const [selected, setSelected] = useState<string[]>([]);
  const [cookieText, setCookieText] = useState("");
  const [settings, setSettings] = useState<AccountManagerSettings>(defaultAccountManagerSettings);
  const [placeIdCheck, setPlaceIdCheck] = useState<string | null>(null);
  const [preview, setPreview] = useState<WindowArrangementResult | null>(null);
  const [loginSession, setLoginSession] = useState<string | null>(null);

  const accounts = useMemo(() => state?.accounts ?? [], [state]);
  const totals = state?.resourceTotals;

  useEffect(() => {
    if (state?.settings) setSettings(state.settings);
  }, [state?.settings]);

  // Browser login is a poll loop in the desktop client too.
  useEffect(() => {
    if (!loginSession) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const result = await accountManagerApi.pollBrowserLogin(loginSession);
          const status = String(result["status"] ?? "pending");
          if (status === "completed") {
            setLoginSession(null);
            toasts.push("Browser login completed.", "success");
            void onRefresh();
          } else if (status !== "pending") {
            setLoginSession(null);
            toasts.push(`Browser login ${status}.`);
          }
        } catch (error) {
          setLoginSession(null);
          toasts.push(error instanceof Error ? error.message : String(error), "error");
        }
      })();
    }, BROWSER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loginSession, onRefresh, toasts]);

  const toggle = (id: string) => {
    setSelected(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id],
    );
  };

  const allSelected = accounts.length > 0 && selected.length === accounts.length;

  const importCookies = async () => {
    const cookies = cookieText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (cookies.length === 0) {
      toasts.push("Paste at least one cookie.", "error");
      return;
    }
    const result = await toasts.run(() => accountManagerApi.importCookies(cookies));
    if (result !== undefined) {
      const imported = (result as { imported?: number }).imported ?? 0;
      const duplicates = (result as { duplicates?: number }).duplicates ?? 0;
      toasts.push(`Imported ${imported} account(s); ${duplicates} duplicate(s).`, "success");
      setCookieText("");
      await onRefresh();
    }
  };

  const act = async (action: () => Promise<unknown>, success: string) => {
    if (selected.length === 0) {
      toasts.push("Select at least one account.", "error");
      return;
    }
    const result = await toasts.run(action);
    if (result !== undefined) {
      toasts.push(success, "success");
      await onRefresh();
    }
  };

  const saveSettings = async (next: AccountManagerSettings) => {
    setSettings(next);
    await toasts.run(() => accountManagerApi.saveSettings(next), { success: "Settings saved." });
    await onRefresh();
  };

  const validatePlace = async () => {
    const result = await toasts.run(() => accountManagerApi.validatePlaceId(settings.defaultPlaceId));
    if (result !== undefined) {
      const valid = (result as { valid?: boolean }).valid === true;
      const reason = (result as { reason?: string | null }).reason;
      const name = (result as { name?: string | null }).name;
      setPlaceIdCheck(valid ? `Valid — ${name}` : (reason ?? "Invalid place id."));
    }
  };

  return (
    <div className="panel">
      <h1>Account manager</h1>
      <p className="subtitle">Import accounts, launch instances, and arrange their windows.</p>

      <div className="card">
        <div className="stat-grid">
          <div className="stat">
            <div className="value">{accounts.length}</div>
            <div className="label">Accounts</div>
          </div>
          <div className="stat">
            <div className="value">{totals?.activeProcessCount ?? 0}</div>
            <div className="label">Active</div>
          </div>
          <div className="stat">
            <div className="value">{formatBytes(Number(totals?.["committedMemoryBytes"] ?? 0))}</div>
            <div className="label">Committed memory</div>
          </div>
          <div className="stat">
            <div className="value">{state?.privateServers?.length ?? 0}</div>
            <div className="label">Private servers</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Accounts</h2>
        <div className="button-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn primary small"
            onClick={() =>
              void act(
                () => accountManagerApi.launchAccounts(selected),
                `Launched ${selected.length} account(s).`,
              )
            }
          >
            <PlayIcon /> Launch
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void act(() => accountManagerApi.stopAccounts(selected), `Stopped ${selected.length} account(s).`)
            }
          >
            <StopIcon /> Stop
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void act(() => accountManagerApi.checkCookies(selected), "Cookies checked.")}
          >
            Check cookies
          </button>
          <button
            type="button"
            className="btn danger small"
            onClick={() =>
              void act(() => accountManagerApi.deleteAccounts(selected), "Accounts deleted.").then(() =>
                setSelected([]),
              )
            }
          >
            <TrashIcon /> Delete
          </button>
          <button type="button" className="btn small" onClick={() => void onRefresh()}>
            <RefreshIcon /> Refresh
          </button>
          <button
            type="button"
            className="btn small"
            disabled={loginSession !== null}
            onClick={() =>
              void toasts
                .run(() => accountManagerApi.startBrowserLogin())
                .then(result => {
                  if (result) {
                    setLoginSession(result.sessionId);
                    toasts.push(`Waiting for ${result.browserName}…`);
                  }
                })
            }
          >
            {loginSession ? "Waiting for browser…" : "Browser login"}
          </button>
          {loginSession && (
            <button
              type="button"
              className="btn small"
              onClick={() =>
                void toasts.run(() => accountManagerApi.cancelBrowserLogin(loginSession)).then(() => {
                  setLoginSession(null);
                })
              }
            >
              Cancel
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  type="checkbox"
                  aria-label="Select all accounts"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : accounts.map(a => String(a.userId)))}
                />
              </th>
              <th>Account</th>
              <th>Status</th>
              <th>Cookie</th>
              <th>PID</th>
              <th>Memory</th>
              <th>Last launch</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td className="empty" colSpan={7}>
                  No accounts yet. Import a cookie below to get started.
                </td>
              </tr>
            )}
            {accounts.map(account => {
              const id = String(account.userId);
              return (
                <tr key={id} className={selected.includes(id) ? "selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${account.displayName}`}
                      checked={selected.includes(id)}
                      onChange={() => toggle(id)}
                    />
                  </td>
                  <td>
                    <div>{account.displayName}</div>
                    <div className="mono muted">{id}</div>
                  </td>
                  <td>
                    <span className={`badge ${account.activePid != null ? "ok" : "muted"}`}>
                      {account.activePid != null ? "running" : "offline"}
                    </span>
                  </td>
                  <td>
                    <span className="badge ok">{account.cookieStatus}</span>
                  </td>
                  <td className="mono">{account.activePid ?? "—"}</td>
                  <td className="mono">{formatBytes(account.resourceUsage?.committedMemoryBytes ?? 0)}</td>
                  <td className="mono">{formatTime(account.lastLaunchAtMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="card-title">Import cookies</h2>
        <p className="card-hint">
          One <span className="mono">.ROBLOSECURITY</span> cookie per line. Cookies are hashed before they are
          stored; the plaintext never reaches disk.
        </p>
        <textarea
          value={cookieText}
          onChange={event => setCookieText(event.target.value)}
          placeholder="_|WARNING:-DO-NOT-SHARE-THIS…"
          aria-label="Cookies to import"
        />
        <div className="button-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary small" onClick={() => void importCookies()}>
            Import
          </button>
          <button type="button" className="btn small" onClick={() => setCookieText("")}>
            Clear
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Launch settings</h2>

        <div className="field">
          <label htmlFor="am-place">Default place id</label>
          <div className="button-row">
            <input
              id="am-place"
              type="text"
              style={{ flex: 1, minWidth: 200 }}
              value={settings.defaultPlaceId}
              onChange={event => setSettings({ ...settings, defaultPlaceId: event.target.value })}
            />
            <button type="button" className="btn small" onClick={() => void validatePlace()}>
              Validate
            </button>
          </div>
          {placeIdCheck && <div className="hint">{placeIdCheck}</div>}
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="am-launch-delay">Launch delay (ms)</label>
            <input
              id="am-launch-delay"
              type="number"
              min={0}
              value={settings.launchDelayMs}
              onChange={event => setSettings({ ...settings, launchDelayMs: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="am-relaunch-delay">Relaunch delay (ms)</label>
            <input
              id="am-relaunch-delay"
              type="number"
              min={0}
              value={settings.relaunchDelayMs}
              onChange={event => setSettings({ ...settings, relaunchDelayMs: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="am-ps-mode">Private server mode</label>
            <select
              id="am-ps-mode"
              value={settings.privateServerMode}
              onChange={event => setSettings({ ...settings, privateServerMode: event.target.value })}
            >
              {PRIVATE_SERVER_MODES.map(mode => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="am-overlay">Performance overlay</label>
            <select
              id="am-overlay"
              value={settings.performanceOverlayTile}
              onChange={event =>
                setSettings({
                  ...settings,
                  performanceOverlayTile: event.target.value as PerformanceOverlayTile,
                })
              }
            >
              {OVERLAY_TILES.map(tile => (
                <option key={tile} value={tile}>
                  {tile}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div>
            <div className="label">Auto relaunch</div>
            <div className="hint">Restart an instance when it exits unexpectedly.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoRelaunchEnabled}
            aria-label="Auto relaunch"
            onChange={event => setSettings({ ...settings, autoRelaunchEnabled: event.target.checked })}
          />
        </div>

        <div className="field-row">
          <div>
            <div className="label">Close existing process</div>
            <div className="hint">Terminate a running instance before launching again.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.closeExistingProcess}
            aria-label="Close existing process"
            onChange={event => setSettings({ ...settings, closeExistingProcess: event.target.checked })}
          />
        </div>

        <div className="button-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn primary small" onClick={() => void saveSettings(settings)}>
            Save settings
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Window arrangement</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="wa-width">Window width</label>
            <input
              id="wa-width"
              type="number"
              min={100}
              value={settings.windowArrangement.windowWidth}
              onChange={event =>
                setSettings({
                  ...settings,
                  windowArrangement: {
                    ...settings.windowArrangement,
                    windowWidth: Number(event.target.value),
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="wa-height">Window height</label>
            <input
              id="wa-height"
              type="number"
              min={100}
              value={settings.windowArrangement.windowHeight}
              onChange={event =>
                setSettings({
                  ...settings,
                  windowArrangement: {
                    ...settings.windowArrangement,
                    windowHeight: Number(event.target.value),
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="wa-per-row">Windows per row</label>
            <input
              id="wa-per-row"
              type="number"
              min={0}
              disabled={settings.windowArrangement.autoLayout}
              value={settings.windowArrangement.windowsPerRow}
              onChange={event =>
                setSettings({
                  ...settings,
                  windowArrangement: {
                    ...settings.windowArrangement,
                    windowsPerRow: Number(event.target.value),
                  },
                })
              }
            />
          </div>
        </div>

        <div className="field-row">
          <div>
            <div className="label">Auto layout</div>
            <div className="hint">Derive the grid from the desktop size.</div>
          </div>
          <input
            type="checkbox"
            aria-label="Auto layout"
            checked={settings.windowArrangement.autoLayout}
            onChange={event =>
              setSettings({
                ...settings,
                windowArrangement: { ...settings.windowArrangement, autoLayout: event.target.checked },
              })
            }
          />
        </div>

        <div className="button-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void toasts
                .run(() => accountManagerApi.previewWindowArrangement(settings))
                .then(result => result && setPreview(result))
            }
          >
            Preview
          </button>
          <button
            type="button"
            className="btn primary small"
            onClick={() =>
              void toasts
                .run(() => accountManagerApi.arrangeWindows(settings), { success: "Windows arranged." })
                .then(result => result && setPreview(result))
            }
          >
            Arrange
          </button>
        </div>

        {preview && (
          <p className="card-hint" style={{ marginTop: 10 }}>
            {preview.arranged} arranged, {preview.skipped} skipped on a{" "}
            {preview.desktopWidth}×{preview.desktopHeight} desktop.
          </p>
        )}
      </div>
    </div>
  );
}

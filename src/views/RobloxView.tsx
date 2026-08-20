import { useEffect, useState } from "react";
import { robloxApi } from "../../api/roblox";
import { updaterApi } from "../../api/sessionAndUpdater";
import type { NamzBinVersionInfo } from "../../types/client";
import { useToasts } from "../runtime/useToasts";
import { RefreshIcon } from "../components/Icons";

const UPDATE_ENDPOINTS = ["https://updates.volt.local/latest", "https://mirror.volt.local/latest"];
const UPDATE_TIMEOUT_MS = 5000;

export function RobloxView({ onStatus }: { onStatus: (message: string) => void }) {
  const toasts = useToasts();
  const [path, setPath] = useState("");
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState("");
  const [binInfo, setBinInfo] = useState<NamzBinVersionInfo | null>(null);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const load = async () => {
    try {
      const [robloxPath, robloxVersion, currentChannel] = await Promise.all([
        robloxApi.getPath(),
        robloxApi.getVersion(),
        robloxApi.currentChannel(),
      ]);
      setPath(robloxPath);
      setVersion(robloxVersion);
      setChannel(currentChannel);
      setBinInfo(await robloxApi.getNamzBinVersionInfo(robloxPath));
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : String(error), "error");
    }
  };

  useEffect(() => {
    void load();
    // `load` is stable for this view's lifetime; re-running on every render
    // would loop the backend calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: () => Promise<unknown>, message: string) => {
    const result = await toasts.run(action, { success: message });
    if (result !== undefined) {
      onStatus(message);
      await load();
    }
  };

  return (
    <div className="panel">
      <h1>Roblox</h1>
      <p className="subtitle">Installation, channel, and updater controls.</p>

      <div className="card">
        <h2 className="card-title">Installation</h2>
        <div className="stat-grid">
          <div className="stat">
            <div className="value mono" style={{ fontSize: 13 }}>
              {version || "—"}
            </div>
            <div className="label">Roblox version</div>
          </div>
          <div className="stat">
            <div className="value mono" style={{ fontSize: 13 }}>
              {channel || "—"}
            </div>
            <div className="label">Channel</div>
          </div>
          <div className="stat">
            <div className="value mono" style={{ fontSize: 13 }}>
              {binInfo?.version ?? "—"}
            </div>
            <div className="label">Volt binary</div>
          </div>
          <div className="stat">
            <div className="value mono" style={{ fontSize: 13 }}>
              {binInfo?.supportedRobloxVersion ?? "—"}
            </div>
            <div className="label">Supported version</div>
          </div>
        </div>
        <p className="card-hint mono" style={{ marginTop: 12, marginBottom: 0 }}>
          {path || "…"}
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Actions</h2>
        <div className="button-row">
          <button type="button" className="btn small" onClick={() => void load()}>
            <RefreshIcon /> Refresh
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void run(async () => {
                const picked = await robloxApi.pickDirectory();
                return robloxApi.validateAndUpdatePath(picked);
              }, "Roblox path validated.")
            }
          >
            Locate install
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void run(() => robloxApi.forceLiveChannel(), "Forced the LIVE channel.")}
          >
            Force live channel
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void run(() => robloxApi.cancelForceLiveChannel(), "Channel force cancelled.")}
          >
            Cancel force
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void run(() => robloxApi.restoreCachedNamzFiles(), "Cached files restored.")}
          >
            Restore cached files
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void run(() => robloxApi.deleteRegistry(), "Registry entry removed.")}
          >
            Delete registry
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => void run(() => robloxApi.deleteInstaller(path), "Installer removed.")}
          >
            Delete installer
          </button>
          <button
            type="button"
            className="btn primary small"
            onClick={() => void run(() => robloxApi.launch(path), "Roblox launched.")}
          >
            Launch Roblox
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Build</h2>
        <div className="button-row">
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void toasts.run(() => robloxApi.buildInfo(channel || "LIVE")).then(info => {
                if (info) setUpdateResult(JSON.stringify(info, null, 2));
              })
            }
          >
            Fetch build info
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void toasts
                .run(() => updaterApi.checkWithDomains(UPDATE_ENDPOINTS, UPDATE_TIMEOUT_MS))
                .then(result => {
                  if (result) setUpdateResult(JSON.stringify(result, null, 2));
                })
            }
          >
            Check for updates
          </button>
        </div>
        {updateResult && (
          <pre className="mono" style={{ marginTop: 12, marginBottom: 0, whiteSpace: "pre-wrap" }}>
            {updateResult}
          </pre>
        )}
      </div>
    </div>
  );
}

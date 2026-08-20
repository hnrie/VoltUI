import { useCallback, useEffect, useMemo, useState } from "react";
import { desktopApi } from "../api/desktop";
import { robloxApi } from "../api/roblox";
import { accountManagerApi } from "../api/accountManager";
import type { ConnectionInfo } from "../types/client";
import type { AccountManagerStateView } from "../types/accountManager";
import { onBackendConnectionChange } from "./runtime/tauriBridge";
import { ToastProvider, useToasts } from "./runtime/useToasts";
import type { AuthUser } from "./runtime/authClient";
import { clearSession, readStoredSession, verifySession } from "./runtime/authClient";
import { LoginScreen } from "./views/LoginScreen";
import { EditorView } from "./views/EditorView";
import { AccountManagerView } from "./views/AccountManagerView";
import { FilesView } from "./views/FilesView";
import { ClientSettingsView } from "./views/ClientSettingsView";
import { RobloxView } from "./views/RobloxView";
import { TitleBar } from "./components/TitleBar";
import { StatusBar } from "./components/StatusBar";
import { BoxIcon, CodeIcon, FilesIcon, SettingsIcon, UsersIcon } from "./components/Icons";

export type ViewId = "editor" | "accounts" | "files" | "client" | "roblox";

const VIEWS: Array<{ id: ViewId; label: string; icon: JSX.Element }> = [
  { id: "editor", label: "Editor", icon: <CodeIcon /> },
  { id: "accounts", label: "Account manager", icon: <UsersIcon /> },
  { id: "files", label: "Files", icon: <FilesIcon /> },
  { id: "client", label: "Client settings", icon: <SettingsIcon /> },
  { id: "roblox", label: "Roblox", icon: <BoxIcon /> },
];

function Workspace({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const toasts = useToasts();
  const [view, setView] = useState<ViewId>("editor");
  const [backendConnected, setBackendConnected] = useState(true);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [accountState, setAccountState] = useState<AccountManagerStateView | null>(null);
  const [robloxVersion, setRobloxVersion] = useState("unknown");
  const [binVersion, setBinVersion] = useState("unknown");
  const [topmost, setTopmost] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Ready");

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await desktopApi.getConnections());
    } catch {
      // Connection polling failures are shown by the status dot, not a toast.
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    try {
      setAccountState(await accountManagerApi.getState());
    } catch (error) {
      toasts.push(error instanceof Error ? error.message : String(error), "error");
    }
  }, [toasts]);

  // Initial load of the values the shell shows everywhere.
  useEffect(() => {
    void refreshConnections();
    void refreshAccounts();
    void (async () => {
      try {
        const [version, path] = await Promise.all([robloxApi.getVersion(), robloxApi.getPath()]);
        setRobloxVersion(version);
        const info = await robloxApi.getNamzBinVersionInfo(path);
        setBinVersion(info.version);
      } catch {
        // The status bar keeps its "unknown" placeholders.
      }
    })();
  }, [refreshAccounts, refreshConnections]);

  // Live updates from the backend event bus, delivered through api/invoke.ts.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void accountManagerApi
      .listen(event => {
        const kind = typeof event["kind"] === "string" ? (event["kind"] as string) : "event";
        setStatusMessage(`account-manager: ${kind}`);
        void refreshAccounts();
        void refreshConnections();
      })
      .then(dispose => {
        if (disposed) dispose();
        else unlisten = dispose;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refreshAccounts, refreshConnections]);

  useEffect(() => onBackendConnectionChange(setBackendConnected), []);

  const activeAccounts = useMemo(
    () => (accountState?.accounts ?? []).filter(account => account.activePid != null).length,
    [accountState],
  );

  return (
    <div className="app-shell">
      <TitleBar
        topmost={topmost}
        onToggleTopmost={setTopmost}
        onSignOut={onSignOut}
        username={user.username}
      />

      <div className="app-body">
        <nav className="activity-bar">
          {VIEWS.map(item => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={view === item.id}
              className={`activity-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              {item.icon}
            </button>
          ))}
          <div className="activity-spacer" />
        </nav>

        <main className="app-main">
          <div className="app-content">
            {view === "editor" && <EditorView connections={connections} onRefresh={refreshConnections} />}
            {view === "accounts" && (
              <AccountManagerView state={accountState} onRefresh={refreshAccounts} />
            )}
            {view === "files" && <FilesView />}
            {view === "client" && <ClientSettingsView />}
            {view === "roblox" && <RobloxView onStatus={setStatusMessage} />}
          </div>
        </main>
      </div>

      <StatusBar
        backendConnected={backendConnected}
        connections={connections}
        robloxVersion={robloxVersion}
        binVersion={binVersion}
        activeAccounts={activeAccounts}
        message={statusMessage}
      />
    </div>
  );
}

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setChecking(false);
      return;
    }
    void verifySession(stored.accessToken)
      .then(verified => setUser(verified))
      .finally(() => setChecking(false));
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  if (checking) {
    return (
      <div className="login-screen">
        <span className="muted">Loading…</span>
      </div>
    );
  }

  return (
    <ToastProvider>
      {user ? <Workspace user={user} onSignOut={signOut} /> : <LoginScreen onAuthenticated={setUser} />}
    </ToastProvider>
  );
}

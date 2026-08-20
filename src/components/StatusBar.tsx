import type { ConnectionInfo } from "../../types/client";
import { BoltIcon } from "./Icons";

interface StatusBarProps {
  backendConnected: boolean;
  connections: ConnectionInfo[];
  robloxVersion: string;
  binVersion: string;
  activeAccounts: number;
  message: string;
}

export function StatusBar({
  backendConnected,
  connections,
  robloxVersion,
  binVersion,
  activeAccounts,
  message,
}: StatusBarProps) {
  return (
    <div className="statusbar">
      <span className="statusbar-item">
        <span className={`status-dot ${backendConnected ? "online" : "offline"}`} />
        {backendConnected ? "Backend connected" : "Backend offline"}
      </span>
      <span className="statusbar-item">
        <BoltIcon size={11} />
        {connections.length} instance{connections.length === 1 ? "" : "s"}
      </span>
      <span className="statusbar-item">{activeAccounts} active</span>
      <span className="statusbar-spacer" />
      <span className="statusbar-item mono">{message}</span>
      <span className="statusbar-item mono">volt {binVersion}</span>
      <span className="statusbar-item mono">{robloxVersion}</span>
    </div>
  );
}

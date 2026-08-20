import { desktopApi } from "../../api/desktop";
import { useToasts } from "../runtime/useToasts";
import { BoltIcon, CloseIcon, LogOutIcon, MaximizeIcon, MinimizeIcon } from "./Icons";

interface TitleBarProps {
  topmost: boolean;
  onToggleTopmost: (next: boolean) => void;
  onSignOut: () => void;
  username: string;
}

export function TitleBar({ topmost, onToggleTopmost, onSignOut, username }: TitleBarProps) {
  const toasts = useToasts();

  const setTopmost = async (next: boolean) => {
    const result = await toasts.run(() => desktopApi.setTopmost(next));
    if (result !== undefined) onToggleTopmost(next);
  };

  return (
    <div className="titlebar">
      <div className="titlebar-logo">
        <BoltIcon size={15} />
        <span>Volt</span>
      </div>

      <div className="titlebar-menu">
        <button type="button" onClick={() => toasts.push("Menu actions are available from each panel.")}>
          File
        </button>
        <button type="button" onClick={() => toasts.push("Menu actions are available from each panel.")}>
          Edit
        </button>
        <button type="button" onClick={() => toasts.push("Menu actions are available from each panel.")}>
          View
        </button>
      </div>

      <div className="titlebar-spacer" />

      <div className="titlebar-actions">
        <span className="muted mono">{username}</span>
        <button
          type="button"
          className={`btn small ${topmost ? "primary" : ""}`}
          onClick={() => void setTopmost(!topmost)}
          title="Keep the window on top"
        >
          Always on top
        </button>
        <button type="button" className="btn small" onClick={onSignOut} title="Sign out">
          <LogOutIcon size={13} />
        </button>
      </div>

      <div className="window-buttons">
        <button type="button" title="Minimize" onClick={() => toasts.push("Window controls are managed by the browser.")}>
          <MinimizeIcon />
        </button>
        <button type="button" title="Maximize" onClick={() => toasts.push("Window controls are managed by the browser.")}>
          <MaximizeIcon />
        </button>
        <button
          type="button"
          className="danger"
          title="Close"
          onClick={() => toasts.push("Window controls are managed by the browser.")}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

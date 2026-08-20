import { useCallback, useEffect, useRef, useState } from "react";
import { desktopApi } from "../../api/desktop";
import type { ClientMessage, ConnectionInfo } from "../../types/client";
import { defaultSettings } from "../../defaultSettings";
import { on } from "../../api/invoke";
import { useToasts } from "../runtime/useToasts";
import { CloseIcon, PlayIcon, PlusIcon, RefreshIcon } from "../components/Icons";

interface EditorTab {
  id: number;
  title: string;
  content: string;
  savedPath: string | null;
}

interface ConsoleLine {
  id: number;
  time: string;
  text: string;
  kind: "info" | "error" | "success";
}

const STARTER_SCRIPT = `-- Volt script editor
local players = game:GetService("Players")

print("Hello from " .. players.LocalPlayer.Name)
`;

let tabSequence = 1;
let lineSequence = 1;

function timestamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

export function EditorView({
  connections,
  onRefresh,
}: {
  connections: ConnectionInfo[];
  onRefresh: () => Promise<void>;
}) {
  const toasts = useToasts();
  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: tabSequence, title: "script.lua", content: STARTER_SCRIPT, savedPath: null },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabSequence);
  const [target, setTarget] = useState("");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0];

  const log = useCallback((text: string, kind: ConsoleLine["kind"] = "info") => {
    setLines(current => [...current.slice(-199), { id: lineSequence++, time: timestamp(), text, kind }]);
  }, []);

  // Execution results arrive on the same channel the desktop core used.
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void on<ClientMessage>("client-message", message => {
      const preview = typeof message["preview"] === "string" ? (message["preview"] as string) : "";
      log(`[${message.msg_type}] ${preview || JSON.stringify(message)}`, "success");
    }).then(dispose => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [log]);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [lines]);

  // Keep the target selector pointed at a live instance.
  useEffect(() => {
    if (connections.length === 0) {
      if (target !== "") setTarget("");
      return;
    }
    if (!connections.some(connection => connection.id === target)) {
      setTarget(connections[0].id);
    }
  }, [connections, target]);

  const updateActive = (content: string) => {
    setTabs(current => current.map(tab => (tab.id === activeTabId ? { ...tab, content } : tab)));
  };

  const addTab = () => {
    tabSequence += 1;
    const tab: EditorTab = { id: tabSequence, title: `script-${tabSequence}.lua`, content: "", savedPath: null };
    setTabs(current => [...current, tab]);
    setActiveTabId(tab.id);
  };

  const closeTab = (id: number) => {
    setTabs(current => {
      const next = current.filter(tab => tab.id !== id);
      if (next.length === 0) {
        tabSequence += 1;
        const replacement = { id: tabSequence, title: "script.lua", content: "", savedPath: null };
        setActiveTabId(replacement.id);
        return [replacement];
      }
      if (id === activeTabId) setActiveTabId(next[next.length - 1].id);
      return next;
    });
  };

  const execute = async () => {
    if (!activeTab) return;
    if (!target) {
      log("No client instance selected. Launch an account first.", "error");
      return;
    }
    const result = await toasts.run(() => desktopApi.executeScript(target, activeTab.content));
    if (result !== undefined) log(`Executed ${activeTab.title} on ${target}`, "success");
  };

  const save = async () => {
    if (!activeTab) return;
    const saved = await toasts.run(
      () => desktopApi.saveFileToScripts(activeTab.title, activeTab.content),
      { success: "Saved to the scripts folder." },
    );
    if (typeof saved === "string") {
      setTabs(current => current.map(tab => (tab.id === activeTabId ? { ...tab, savedPath: saved } : tab)));
      log(`Saved ${saved}`);
    }
  };

  return (
    <div className="editor-layout">
      <div className="tab-strip">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => setActiveTabId(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTabId}
          >
            <span>{tab.title}</span>
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${tab.title}`}
              onClick={event => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <CloseIcon size={11} />
            </button>
          </div>
        ))}
        <button type="button" className="tab" onClick={addTab} aria-label="New tab">
          <PlusIcon size={13} />
        </button>
      </div>

      <div className="editor-toolbar">
        <button type="button" className="btn primary small" onClick={() => void execute()}>
          <PlayIcon /> Execute
        </button>
        <button type="button" className="btn small" onClick={() => void save()}>
          Save
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => updateActive("")}
          disabled={!activeTab?.content}
        >
          Clear
        </button>

        <span style={{ flex: 1 }} />

        <label className="muted" htmlFor="editor-target">
          Target
        </label>
        <select
          id="editor-target"
          value={target}
          onChange={event => setTarget(event.target.value)}
          style={{ minWidth: 190 }}
        >
          {connections.length === 0 && <option value="">No instances connected</option>}
          {connections.map(connection => (
            <option key={connection.id} value={connection.id}>
              {String(connection["displayName"] ?? connection.id)}
            </option>
          ))}
        </select>
        <button type="button" className="btn small" onClick={() => void onRefresh()} aria-label="Refresh instances">
          <RefreshIcon />
        </button>
      </div>

      <div className="editor-surface">
        <textarea
          className="editor-textarea"
          spellCheck={false}
          value={activeTab?.content ?? ""}
          onChange={event => updateActive(event.target.value)}
          style={{
            fontFamily: defaultSettings.editor.fontFamily,
            fontSize: defaultSettings.editor.fontSize,
            tabSize: defaultSettings.editor.tabSize,
          }}
          aria-label="Script editor"
        />
      </div>

      <div className="console">
        <div className="console-header">
          <span>Console</span>
          <button type="button" className="btn small" onClick={() => setLines([])}>
            Clear
          </button>
        </div>
        <div className="console-body" ref={consoleRef}>
          {lines.length === 0 && <div className="muted">Execution output appears here.</div>}
          {lines.map(line => (
            <div key={line.id} className={`console-line ${line.kind}`}>
              <span className="console-time">{line.time}</span>
              <span className="console-text">{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

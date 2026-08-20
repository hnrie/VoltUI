import { useCallback, useEffect, useState } from "react";
import { desktopApi } from "../../api/desktop";
import type { DirectoryEntryInfo } from "../../types/files";
import { useToasts } from "../runtime/useToasts";
import { FileIcon, FolderIcon, PlusIcon, RefreshIcon, TrashIcon } from "../components/Icons";

interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
}

function toEntry(raw: DirectoryEntryInfo): Entry {
  return {
    name: String(raw["name"] ?? ""),
    path: String(raw["path"] ?? ""),
    isDirectory: raw["isDirectory"] === true,
    sizeBytes: Number(raw["sizeBytes"] ?? 0),
  };
}

export function FilesView() {
  const toasts = useToasts();
  const [roots, setRoots] = useState<{ scripts: string; autoexec: string; workspace: string } | null>(null);
  const [current, setCurrent] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [contents, setContents] = useState<string>("");
  const [newName, setNewName] = useState("");

  const listDirectory = useCallback(
    async (path: string) => {
      const result = await toasts.run(() => desktopApi.listDirectoryEntries(path));
      if (result !== undefined) setEntries(result.map(toEntry));
    },
    [toasts],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [scripts, autoexec, workspace] = await Promise.all([
          desktopApi.getScriptsDirectory(),
          desktopApi.getAutoexecDirectory(),
          desktopApi.getWorkspaceDirectory(),
        ]);
        setRoots({ scripts, autoexec, workspace });
        setCurrent(scripts);
      } catch (error) {
        toasts.push(error instanceof Error ? error.message : String(error), "error");
      }
    })();
  }, [toasts]);

  useEffect(() => {
    if (current) void listDirectory(current);
  }, [current, listDirectory]);

  const openEntry = async (entry: Entry) => {
    if (entry.isDirectory) {
      setCurrent(entry.path);
      setSelected(null);
      setContents("");
      return;
    }
    setSelected(entry);
    const text = await toasts.run(() => desktopApi.readFile(entry.path));
    setContents(text ?? "");
  };

  const saveSelected = async () => {
    if (!selected) return;
    await toasts.run(() => desktopApi.writeFile(selected.path, contents), { success: "File saved." });
    await listDirectory(current);
  };

  const deleteSelected = async () => {
    if (!selected) return;
    await toasts.run(() => desktopApi.deleteFile(selected.path), { success: "File deleted." });
    setSelected(null);
    setContents("");
    await listDirectory(current);
  };

  const createFile = async () => {
    const name = newName.trim();
    if (!name) {
      toasts.push("Enter a file name.", "error");
      return;
    }
    await toasts.run(() => desktopApi.writeFile(`${current}/${name}`, ""), { success: "File created." });
    setNewName("");
    await listDirectory(current);
  };

  return (
    <div className="panel">
      <h1>Files</h1>
      <p className="subtitle">Browse and edit the managed workspace directories.</p>

      <div className="card">
        <div className="button-row">
          {roots && (
            <>
              <button type="button" className="btn small" onClick={() => setCurrent(roots.scripts)}>
                Scripts
              </button>
              <button type="button" className="btn small" onClick={() => setCurrent(roots.autoexec)}>
                Autoexec
              </button>
              <button type="button" className="btn small" onClick={() => setCurrent(roots.workspace)}>
                Workspace
              </button>
            </>
          )}
          <button type="button" className="btn small" onClick={() => void listDirectory(current)}>
            <RefreshIcon /> Refresh
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              void toasts.run(() => desktopApi.openFolderInExplorer(current), {
                success: "Folder path resolved.",
              })
            }
          >
            <FolderIcon /> Reveal
          </button>
        </div>
        <p className="card-hint mono" style={{ marginTop: 10, marginBottom: 0 }}>
          {current || "…"}
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Entries</h2>
        {entries.length === 0 && <p className="card-hint">This directory is empty.</p>}
        {entries.map(entry => (
          <button
            key={entry.path}
            type="button"
            className={`tree-item ${selected?.path === entry.path ? "active" : ""}`}
            onClick={() => void openEntry(entry)}
          >
            {entry.isDirectory ? <FolderIcon /> : <FileIcon />}
            <span className="name">{entry.name}</span>
            {!entry.isDirectory && <span className="muted mono">{entry.sizeBytes} B</span>}
          </button>
        ))}

        <div className="button-row" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="new-script.lua"
            value={newName}
            aria-label="New file name"
            onChange={event => setNewName(event.target.value)}
          />
          <button type="button" className="btn small" onClick={() => void createFile()}>
            <PlusIcon /> Create file
          </button>
        </div>
      </div>

      {selected && (
        <div className="card">
          <h2 className="card-title">{selected.name}</h2>
          <p className="card-hint mono">{selected.path}</p>
          <textarea
            value={contents}
            onChange={event => setContents(event.target.value)}
            aria-label={`Contents of ${selected.name}`}
            style={{ minHeight: 220 }}
          />
          <div className="button-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn primary small" onClick={() => void saveSelected()}>
              Save
            </button>
            <button type="button" className="btn danger small" onClick={() => void deleteSelected()}>
              <TrashIcon /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

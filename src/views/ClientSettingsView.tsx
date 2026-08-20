import { useEffect, useState } from "react";
import { desktopApi } from "../../api/desktop";
import type { ClientSettings, InstanceIdentification } from "../../types/client";
import { useToasts } from "../runtime/useToasts";

const IDENTIFICATION: InstanceIdentification[] = ["processId", "username", "displayName"];

/** Toggle rows rendered straight from the recovered ClientSettings shape. */
const TOGGLES: Array<{ key: keyof ClientSettings; label: string; hint: string }> = [
  { key: "redirectOutput", label: "Redirect output", hint: "Send client output to the Volt console." },
  { key: "disableInternalUi", label: "Disable internal UI", hint: "Hide the in-game overlay." },
  { key: "enableSourceMap", label: "Enable source map", hint: "Collect script source maps." },
  { key: "enableExplorer", label: "Enable explorer", hint: "Expose the instance explorer." },
  { key: "enableStatus", label: "Enable status", hint: "Report client status back to Volt." },
  { key: "enableBitLibrary", label: "Bit library", hint: "Expose bitwise helpers." },
  { key: "enableRaknetLibrary", label: "Raknet library", hint: "Expose network helpers." },
  { key: "enableAntiAfk", label: "Anti AFK", hint: "Prevent idle disconnects." },
  { key: "securityPurchasePromptHook", label: "Purchase prompt hook", hint: "Intercept purchase prompts." },
  { key: "unlockWindowSize", label: "Unlock window size", hint: "Allow arbitrary window dimensions." },
  { key: "streamProofGraphics", label: "Stream proof graphics", hint: "Hide the client from capture." },
  { key: "enableMultiInstance", label: "Multi instance", hint: "Allow more than one client." },
  { key: "closeOnInGameError", label: "Close on in-game error", hint: "Exit when the client errors." },
  { key: "memoryGuardEnabled", label: "Memory guard", hint: "Restart when memory exceeds the limit." },
  { key: "silentErrors", label: "Silent errors", hint: "Suppress error dialogs." },
];

export function ClientSettingsView() {
  const toasts = useToasts();
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [filePath, setFilePath] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const state = await desktopApi.getClientSettingsFileState();
        setFilePath(String(state["path"] ?? ""));
        setSettings((state["settings"] ?? null) as ClientSettings | null);
      } catch (error) {
        toasts.push(error instanceof Error ? error.message : String(error), "error");
      }
    })();
  }, [toasts]);

  if (!settings) {
    return (
      <div className="panel">
        <h1>Client settings</h1>
        <p className="subtitle">Loading…</p>
      </div>
    );
  }

  const update = (patch: Partial<ClientSettings>) => setSettings({ ...settings, ...patch });

  const save = async () => {
    await toasts.run(() => desktopApi.updateClientSettings(settings), { success: "Client settings saved." });
  };

  return (
    <div className="panel">
      <h1>Client settings</h1>
      <p className="subtitle mono">{filePath}</p>

      <div className="card">
        <h2 className="card-title">Behaviour</h2>
        {TOGGLES.map(toggle => (
          <div className="field-row" key={String(toggle.key)}>
            <div>
              <div className="label">{toggle.label}</div>
              <div className="hint">{toggle.hint}</div>
            </div>
            <input
              type="checkbox"
              aria-label={toggle.label}
              checked={Boolean(settings[toggle.key])}
              onChange={event => update({ [toggle.key]: event.target.checked } as Partial<ClientSettings>)}
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Instance</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="cs-identification">Instance identification</label>
            <select
              id="cs-identification"
              value={settings.instanceIdentification}
              onChange={event =>
                update({ instanceIdentification: event.target.value as InstanceIdentification })
              }
            >
              {IDENTIFICATION.map(mode => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cs-keybind">Internal UI keybind</label>
            <input
              id="cs-keybind"
              type="number"
              value={settings.internalUiKeybind}
              onChange={event => update({ internalUiKeybind: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="cs-memory">Memory guard limit (MB)</label>
            <input
              id="cs-memory"
              type="number"
              min={0}
              value={settings.memoryGuardLimitMb}
              onChange={event => update({ memoryGuardLimitMb: Number(event.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="cs-hwid">HWID seed</label>
            <input
              id="cs-hwid"
              type="number"
              value={settings.hwidSeed}
              onChange={event => update({ hwidSeed: Number(event.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Decompiler</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="cs-indent">Indent width</label>
            <input
              id="cs-indent"
              type="number"
              min={1}
              value={settings.decompilerOptions.formatterOptions.indentWidth}
              onChange={event =>
                update({
                  decompilerOptions: {
                    ...settings.decompilerOptions,
                    formatterOptions: {
                      ...settings.decompilerOptions.formatterOptions,
                      indentWidth: Number(event.target.value),
                    },
                  },
                })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="cs-column">Column limit</label>
            <input
              id="cs-column"
              type="number"
              min={1}
              value={settings.decompilerOptions.formatterOptions.columnLimit}
              onChange={event =>
                update({
                  decompilerOptions: {
                    ...settings.decompilerOptions,
                    formatterOptions: {
                      ...settings.decompilerOptions.formatterOptions,
                      columnLimit: Number(event.target.value),
                    },
                  },
                })
              }
            />
          </div>
        </div>

        {(
          [
            ["smartVariableRenamer", "Smart variable renamer"],
            ["functionDeclarations", "Function declarations"],
            ["guardClauses", "Guard clauses"],
            ["constantFolding", "Constant folding"],
            ["conditionalStructurer", "Conditional structurer"],
          ] as const
        ).map(([key, label]) => (
          <div className="field-row" key={key}>
            <div className="label">{label}</div>
            <input
              type="checkbox"
              aria-label={label}
              checked={settings.decompilerOptions[key]}
              onChange={event =>
                update({
                  decompilerOptions: { ...settings.decompilerOptions, [key]: event.target.checked },
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="card-title">Save instance</h2>
        {(
          [
            ["ignoreArchivable", "Ignore archivable"],
            ["savePlayerCharacters", "Save player characters"],
            ["savePlayers", "Save players"],
            ["disableCompression", "Disable compression"],
            ["decompileScripts", "Decompile scripts"],
            ["saveNonCreatable", "Save non-creatable"],
            ["saveNilInstances", "Save nil instances"],
          ] as const
        ).map(([key, label]) => (
          <div className="field-row" key={key}>
            <div className="label">{label}</div>
            <input
              type="checkbox"
              aria-label={label}
              checked={settings.saveInstanceOptions[key]}
              onChange={event =>
                update({
                  saveInstanceOptions: { ...settings.saveInstanceOptions, [key]: event.target.checked },
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="button-row">
        <button type="button" className="btn primary" onClick={() => void save()}>
          Save client settings
        </button>
      </div>
    </div>
  );
}

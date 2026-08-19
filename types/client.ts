// Field names recovered from Rust serde metadata and frontend normalization code.
export type InstanceIdentification = "processId" | "username" | "displayName";
export type FunctionMetadataLayout = "block" | "inline";
export type UpvalueFormat = "name" | "kind" | "kindAndIndex";

export interface ClientFunctionMetadataOptions {
  enabled: boolean; layout: FunctionMetadataLayout; includeName: boolean; includeLine: boolean;
  includeUpvalues: boolean; upvalueFormat: UpvalueFormat;
}
export interface ClientDecompilerFormatterOptions {
  indentWidth: number; columnLimit: number; functionMetadata: ClientFunctionMetadataOptions;
  parenthesizeConditions: boolean; appendSemicolons: boolean;
}
export interface ClientDecompilerOptions {
  smartVariableRenamer: boolean; functionDeclarations: boolean; guardClauses: boolean;
  constantFolding: boolean; conditionalStructurer: boolean; doBlockInsertionThreshold: number;
  formatterOptions: ClientDecompilerFormatterOptions;
}
export interface ClientSaveInstanceOptions {
  ignoreArchivable: boolean; savePlayerCharacters: boolean; savePlayers: boolean; disableCompression: boolean;
  decompileScripts: boolean; saveNonCreatable: boolean; saveNilInstances: boolean;
}
export interface ClientSettings {
  redirectOutput: boolean; disableInternalUi: boolean; internalUiKeybind: number; enableSourceMap: boolean;
  enableExplorer: boolean; enableStatus: boolean; enableBitLibrary: boolean; enableRaknetLibrary: boolean;
  enableAntiAfk: boolean; securityPurchasePromptHook: boolean; hwidSeed: number; unlockWindowSize: boolean;
  streamProofGraphics: boolean; enableMultiInstance: boolean; closeOnInGameError: boolean;
  memoryGuardEnabled: boolean; memoryGuardLimitMb: number; instanceIdentification: InstanceIdentification;
  silentErrors: boolean; decompilerOptions: ClientDecompilerOptions; saveInstanceOptions: ClientSaveInstanceOptions;
}
export interface ConnectionInfo { id: string; [key: string]: unknown }
export interface ClientMessage { msg_type: string; timestamp_ms: number; [key: string]: unknown }
export interface ClientSourceMap { hash: string; byte_len: number; [key: string]: unknown }
export interface PlayerVersionGuid { [key: string]: unknown }
export interface NamzBinVersionInfo { version: string; supportedRobloxVersion: string; }

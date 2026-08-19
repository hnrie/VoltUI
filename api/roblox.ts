import { call } from "./invoke";
import type { NamzBinVersionInfo } from "../types/client";

export const robloxApi = {
  fileExists: (path: string) => call<boolean>("file_exists", { path }),
  deleteFile: (path: string) => call<boolean>("delete_file", { path }),
  downloadFile: (url: string, fileName: string, robloxPath: string) => call<string>("download_file_from_url_cmd", { url, fileName, robloxPath }),
  getPath: () => call<string>("get_roblox_path_cmd"),
  exists: (path: string) => call<boolean>("roblox_exists_cmd", { path }),
  getVersion: () => call<string>("get_roblox_version_cmd"),
  getFileVersion: (filePath: string) => call<string>("get_file_version_cmd", { filePath }),
  getNamzBinVersionInfo: (path: string) => call<NamzBinVersionInfo>("get_volt_bin_version_info", { path }),
  pickDirectory: () => call<string>("pick_roblox_directory"),
  validateAndUpdatePath: (path: string) => call("validate_and_update_roblox_path", { path }),
  restoreCachedNamzFiles: () => call<boolean>("restore_cached_volt_files_cmd"),
  currentChannel: () => call<string>("get_current_roblox_channel"),
  buildInfo: (channel: string) => call("get_roblox_build_info", { channel }),
  installBuild: (buildInfo: unknown) => call("install_roblox_build", { buildInfo }),
  forceLiveChannel: () => call("force_live_channel"),
  cancelForceLiveChannel: () => call("cancel_force_live_channel"),
  deleteRegistry: () => call("delete_roblox_registry"),
  deleteInstaller: (robloxPath: string) => call("delete_roblox_installer", { robloxPath }),
  launch: (robloxPath: string) => call("launch_roblox", { robloxPath }),
  terminateProcess: (pid: number) => call("terminate_process", { pid }),
};

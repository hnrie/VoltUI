export interface DirectoryEntryInfo { [key: string]: unknown }
export interface WindowLayoutState {
  innerWidth: number; innerHeight: number; outerWidth: number; outerHeight: number; positionX: number; positionY: number;
  isMaximized: boolean; isFullscreen: boolean; scaleFactor?: number;
}
export interface ClientSettingsFileState { [key: string]: unknown }
export interface UpdateMetadata { [key: string]: unknown }

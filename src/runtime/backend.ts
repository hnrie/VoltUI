/**
 * Base path for the Node backend that replaces the Tauri Rust core.
 *
 * It is deliberately not "/api": the recovered library keeps its Tauri
 * bindings in ./api, and a "/api" prefix would shadow those source files when
 * Vite serves them during development.
 */
export const BACKEND_BASE = "/_volt";

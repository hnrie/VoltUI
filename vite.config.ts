import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Node backend that replaces the Tauri Rust core.
const BACKEND = "http://127.0.0.1:8787";

// The backend is mounted under /_volt rather than /api: the recovered library
// keeps its Tauri bindings in ./api, and a "/api" proxy prefix would shadow
// those real source files during dev.
const proxy = {
  "/_volt": { target: BACKEND, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});

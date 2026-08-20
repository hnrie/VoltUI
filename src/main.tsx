import React from "react";
import { createRoot } from "react-dom/client";
import { installTauriBridge } from "./runtime/tauriBridge";

// The bridge must exist before any module that reaches for the Tauri globals
// is used, so it is installed before the theme and the app are imported.
installTauriBridge();

// Recovered theme, imported exactly as theme/index.ts does.
import "../theme/index";
import "./styles/app.css";

import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root was not found.");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

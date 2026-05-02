/**
 * Workbench app entry point — mounts React root for the bottom-panel workbench webview.
 *
 * @see docs/specs/220-app-workbench/spec.md [FR-1] [FR-2]
 * @see docs/specs/220-app-workbench/design.md [DES-ARCH]
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app";
import "./index.css";
import { applyAppearanceClass } from "./lib/appearance";
import { initWorkbenchBridge, workbenchOn } from "./lib/bridge";
import { setClarityEnabled } from "./lib/clarity";

initWorkbenchBridge();
workbenchOn("afxAppearanceUpdated", (msg) => {
  applyAppearanceClass(msg.appearanceClass);
});
workbenchOn("afxTelemetryUpdated", (msg) => {
  setClarityEnabled(msg.enabled);
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

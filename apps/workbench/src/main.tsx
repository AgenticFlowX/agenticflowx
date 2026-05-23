/**
 * Workbench app entry point — mounts React root for the bottom-panel workbench
 * webview, or the standalone editor-area preview when the host marks the body
 * with `data-afx-view="preview"`.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-1] [FR-15]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-SHELL-BRIDGE] [DES-SHELL-PREVIEW-MODE]
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app";
import "./index.css";
import { applyAppearanceClass } from "./lib/appearance";
import { initWorkbenchBridge, workbenchOn } from "./lib/bridge";
import { setClarityEnabled } from "./lib/clarity";
import { PreviewApp } from "./preview-app";

initWorkbenchBridge();
workbenchOn("afxAppearanceUpdated", (msg) => {
  applyAppearanceClass(msg.appearanceClass);
});
workbenchOn("afxTelemetryUpdated", (msg) => {
  setClarityEnabled(msg.enabled);
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
const search = new URLSearchParams(window.location.search);
const IS_PREVIEW_MODE =
  document.body.dataset.afxView === "preview" || search.get("afx-view") === "preview";
createRoot(root).render(<StrictMode>{IS_PREVIEW_MODE ? <PreviewApp /> : <App />}</StrictMode>);

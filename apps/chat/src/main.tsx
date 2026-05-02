/**
 * Chat app entry point — selects transport (VSCode postMessage or mock), mounts React root.
 *
 * @see docs/specs/210-app-chat/spec.md [FR-1]
 * @see docs/specs/210-app-chat/design.md [DES-ARCH]
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createMockTransport, createVscodeTransport } from "@afx/transport";

import App from "./app";
import "./index.css";
import { initTransport } from "./lib/bridge";

// ---------------------------------------------------------------------------
// Transport selection
//
// In VSCode (production + dev via HMR): acquireVsCodeApi is available →
//   use the VSCode postMessage transport.
//
// In plain browser dev (pnpm dev:chat outside VSCode): acquireVsCodeApi is
//   not defined → use the mock transport so the UI works without a local runtime.
// ---------------------------------------------------------------------------

const IS_VSCODE =
  typeof window !== "undefined" &&
  typeof (window as unknown as Record<string, unknown>)["acquireVsCodeApi"] === "function";

const transport = IS_VSCODE ? createVscodeTransport() : createMockTransport();
initTransport(transport);

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(
  <StrictMode>
    <App transport={transport} />
  </StrictMode>,
);

/**
 * @afx/transport — transport abstraction (VSCode postMessage adapter + mock).
 *
 * @see docs/specs/110-package-transport/spec.md [FR-1] [FR-2] [FR-3]
 * @see docs/specs/110-package-transport/design.md [DES-OVR]
 */
export type { LogDirection, LogEntry, MockTransport, ScenarioFn, Transport } from "./types";
export { createMockTransport } from "./mock";
export { createVscodeTransport } from "./vscode";

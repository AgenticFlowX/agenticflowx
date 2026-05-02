/**
 * Browser-side appearance class helper for Settings and DebugPanel preview.
 *
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [FR-5] [FR-6]
 * @see docs/specs/chat-ui-theme-foundation/chat-ui-theme-foundation.md [DES-DEV] [DES-API]
 */
import { AFX_STYLE_IDS, AFX_THEME_IDS, type AfxStyleId, type AfxThemeId } from "@afx/shared";

export type HostModeClass =
  | "vscode-dark"
  | "vscode-light"
  | "vscode-high-contrast"
  | "vscode-high-contrast-light";

export const HOST_MODE_CLASSES: readonly HostModeClass[] = [
  "vscode-dark",
  "vscode-light",
  "vscode-high-contrast",
  "vscode-high-contrast-light",
];

const THEME_CLASSES = AFX_THEME_IDS.map((id) => `theme-${id}`);
const STYLE_CLASSES = AFX_STYLE_IDS.map((id) => `style-${id}`);

export function applyRuntimeAppearance(theme: AfxThemeId, style: AfxStyleId): void {
  document.body.classList.remove(...THEME_CLASSES, ...STYLE_CLASSES, "theme-lyra");
  document.body.classList.add(`theme-${theme}`, `style-${style}`);
}

export function applyDebugHostMode(hostMode: HostModeClass): void {
  if (!canSimulateHostMode()) return;
  document.body.classList.remove(...HOST_MODE_CLASSES);
  document.body.classList.add(hostMode);
}

export function resetDebugAppearance(): void {
  applyRuntimeAppearance("meridian", "lyra");
  if (canSimulateHostMode()) {
    document.body.classList.remove(...HOST_MODE_CLASSES);
    document.body.classList.add("vscode-dark");
  }
}

export function canSimulateHostMode(): boolean {
  const maybeWindow = window as Window & { acquireVsCodeApi?: unknown };
  return typeof maybeWindow.acquireVsCodeApi === "undefined";
}

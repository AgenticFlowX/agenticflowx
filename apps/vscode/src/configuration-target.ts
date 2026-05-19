/**
 * Helpers for choosing and writing AFX VS Code configuration targets.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-11] [FR-12]
 * @see docs/specs/200-app-vscode/design.md [DES-SETTINGS-CATALOG]
 * @see docs/specs/214-app-chat-settings/spec.md [FR-1]
 * @see docs/specs/214-app-chat-settings/design.md [DES-SETTINGS-FLOW]
 */
import * as vscode from "vscode";

import type { Logger } from "@afx/shared";

export function configurationTargetFor(key: string): vscode.ConfigurationTarget {
  const inspected = vscode.workspace.getConfiguration("afx").inspect(key);
  return inspected?.workspaceValue === undefined
    ? vscode.ConfigurationTarget.Global
    : vscode.ConfigurationTarget.Workspace;
}

export async function updateAfxConfigurationWithWorkspaceFallback(
  key: string,
  value: unknown,
  target: vscode.ConfigurationTarget,
  logger?: Logger,
): Promise<vscode.ConfigurationTarget> {
  const cfg = vscode.workspace.getConfiguration("afx");
  try {
    await cfg.update(key, value, target);
    return target;
  } catch (err) {
    if (
      target !== vscode.ConfigurationTarget.Global ||
      (vscode.workspace.workspaceFolders?.length ?? 0) === 0
    ) {
      throw err;
    }

    logger?.warn("global settings write failed; falling back to workspace settings", {
      key: `afx.${key}`,
      reason: err instanceof Error ? err.message : String(err),
    });
    await cfg.update(key, value, vscode.ConfigurationTarget.Workspace);
    return vscode.ConfigurationTarget.Workspace;
  }
}

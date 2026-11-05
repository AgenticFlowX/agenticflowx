/**
 * Explicit Blueprint destination selection with a conventional .afx layout.
 * @see docs/specs/231-app-vscode-blueprint/spec.md [FR-9] [FR-10]
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI] [DES-STORAGE]
 */
import path from "node:path";

import * as vscode from "vscode";

import type { ProjectContext } from "./project-context";

/**
 * Resolve the exact destination before any files are created.
 * @see docs/specs/231-app-vscode-blueprint/design.md [DES-UI] [DES-STORAGE]
 */
export async function chooseBlueprintSaveLocation(
  project: Pick<ProjectContext, "name" | "rootUri">,
): Promise<{ name: string; artifactRoot: string; attach: boolean } | undefined> {
  const name = (
    await vscode.window.showInputBox({
      title: "Save Blueprint…",
      prompt: "Blueprint name",
      value: project.name,
      ignoreFocusOut: true,
    })
  )?.trim();
  if (!name) return undefined;
  const folderName =
    name
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "blueprint";
  const localRoot = path.join(project.rootUri.fsPath, ".afx", "blueprints", folderName);
  const location = await vscode.window.showQuickPick(
    [
      {
        label: "This project's .afx folder",
        description: localRoot,
        detail: "Creates Blueprint files in this repository; they will be visible to Git.",
        mode: "project",
      },
      {
        label: "Another folder's .afx folder…",
        detail: "Choose a parent folder, such as a separate private repository.",
        mode: "parent",
      },
      {
        label: "Custom Blueprint folder…",
        detail: "Use an exact empty artifact folder without adding .afx.",
        mode: "custom",
      },
    ],
    { title: "Save Blueprint — location", ignoreFocusOut: true },
  );
  if (!location) return undefined;
  let artifactRoot = localRoot;
  if (location.mode !== "project") {
    const selected = await vscode.window.showOpenDialog({
      title:
        location.mode === "parent"
          ? "Choose parent folder — saves under .afx/blueprints"
          : "Choose an empty custom Blueprint folder",
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: project.rootUri,
      openLabel: location.mode === "parent" ? "Use Parent Folder" : "Use Exact Folder",
    });
    if (!selected?.[0]) return undefined;
    artifactRoot =
      location.mode === "parent"
        ? path.join(selected[0].fsPath, ".afx", "blueprints", folderName)
        : selected[0].fsPath;
  }
  const action = await vscode.window.showQuickPick(
    [
      {
        label: "Save and Attach",
        description: artifactRoot,
        detail: "Use this Blueprint for external specs, sprints and CodeLens.",
        attach: true,
      },
      {
        label: "Save Research",
        description: artifactRoot,
        detail: "Save research without attaching a coding session.",
        attach: false,
      },
    ],
    {
      title: "Save Blueprint — confirm destination",
      placeHolder: artifactRoot,
      ignoreFocusOut: true,
    },
  );
  return action ? { name, artifactRoot, attach: action.attach } : undefined;
}

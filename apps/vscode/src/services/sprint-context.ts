/**
 * Sprint context-key sync — sets `afx.isSprint` when the active editor holds a
 * single-document sprint file (frontmatter `type: SPRINT` or `FLUID`), and
 * `afx.sprintSection` to which section (`SPEC` / `DESIGN` / `TASKS` /
 * `SESSIONS`) the cursor is currently in. Together they gate spec/design/tasks
 * actions in the right-click and editor-title menus so only the relevant
 * section's actions surface.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 */
import * as vscode from "vscode";

import type { Logger } from "@afx/shared";

import { type SprintSection, findSectionAt, isSprintFile } from "./sprint";

const SPRINT_KEY = "afx.isSprint";
const SECTION_KEY = "afx.sprintSection";

/**
 * Wire context-key sync for sprint files. Returns disposables the caller pushes
 * onto `context.subscriptions`.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 */
export function createSprintContextSync(parentLog: Logger): { disposables: vscode.Disposable[] } {
  const log = parentLog.child("sprint-context");
  let currentSprint = false;
  let currentSection: SprintSection | undefined;

  function setSprint(next: boolean): void {
    if (next === currentSprint) return;
    currentSprint = next;
    void vscode.commands.executeCommand("setContext", SPRINT_KEY, next);
    log.debug(() => `${SPRINT_KEY}=${next}`);
  }

  function setSection(next: SprintSection | undefined): void {
    if (next === currentSection) return;
    currentSection = next;
    void vscode.commands.executeCommand("setContext", SECTION_KEY, next ?? "");
    log.debug(() => `${SECTION_KEY}=${next ?? "(none)"}`);
  }

  function evaluate(editor: vscode.TextEditor | undefined): void {
    if (!isSprintEditor(editor)) {
      setSprint(false);
      setSection(undefined);
      return;
    }
    setSprint(true);
    const cursorLine = editor.selection.active.line;
    setSection(findSectionAt(editor.document.getText(), cursorLine));
  }

  // Initial evaluation for the editor that's already active when we register.
  evaluate(vscode.window.activeTextEditor);

  return {
    disposables: [
      vscode.window.onDidChangeActiveTextEditor((editor) => evaluate(editor)),
      vscode.window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor !== vscode.window.activeTextEditor) return;
        evaluate(event.textEditor);
      }),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document === doc) evaluate(editor);
      }),
    ],
  };
}

function isSprintEditor(editor: vscode.TextEditor | undefined): editor is vscode.TextEditor {
  if (!editor) return false;
  if (editor.document.languageId !== "markdown") return false;
  // Cheap precheck — only files in docs/specs/** can be sprints; skip everything else
  // before paying the frontmatter parse.
  const fsPath = editor.document.uri.fsPath;
  if (!fsPath.includes("/docs/specs/")) return false;
  return isSprintFile(editor.document.getText());
}

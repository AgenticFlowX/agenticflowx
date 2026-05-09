/**
 * Sprint context-key sync — sets `afx.isSprint` when the active editor holds a
 * single-document sprint file (frontmatter `type: SPRINT` or `FLUID`), and
 * `afx.sprintSection` to which section (`SPEC` / `DESIGN` / `TASKS` /
 * `SESSIONS`) the cursor is currently in. Together they gate spec/design/tasks
 * actions in the right-click and editor-title menus so only the relevant
 * section's actions surface.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-3]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-DATA]
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 */
import * as vscode from "vscode";

import { parseFrontmatter } from "@afx/parsers";
import type { Logger } from "@afx/shared";

import { type SprintSection, findSectionAt, isSprintFile } from "./sprint";

const SPRINT_KEY = "afx.isSprint";
const SECTION_KEY = "afx.sprintSection";

/**
 * Active AFX document context payload — same shape posted to the chat webview.
 *
 * `docKind` widens to the full set of AFX file types so the composer doc-actions
 * strip can route to the right command family (`/afx-spec`, `/afx-design`,
 * `/afx-task`, `/afx-session`, `/afx-adr`, `/afx-research`, `/afx-context`).
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
export interface ActiveDocContext {
  format: "sprint" | "standard" | null;
  section: "SPEC" | "DESIGN" | "TASKS" | null;
  docKind: "spec" | "design" | "tasks" | "journal" | "adr" | "research" | "context" | null;
  feature: string | null;
  approvalStatus: string | null;
}

const EMPTY_DOC_CONTEXT: ActiveDocContext = {
  format: null,
  section: null,
  docKind: null,
  feature: null,
  approvalStatus: null,
};

export interface SprintContextOptions {
  /**
   * Called every time the active AFX document context changes — used to push
   * the doc-actions / mode-suggest strip payload to the chat webview.
   *
   * @see docs/specs/100-package-shared/spec.md [FR-12]
   */
  onDocContextChange?: (ctx: ActiveDocContext) => void;
}

/**
 * Wire context-key sync for sprint files. Returns disposables the caller pushes
 * onto `context.subscriptions`.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-3]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-DATA]
 * @see docs/specs/220-app-workbench/spec.md [FR-7]
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
export function createSprintContextSync(
  parentLog: Logger,
  options: SprintContextOptions = {},
): { disposables: vscode.Disposable[] } {
  // Surface: [EditorActions.ContextKeys]
  const log = parentLog.child("sprint-context");
  let currentSprint = false;
  let currentSection: SprintSection | undefined;
  let currentDocContext: ActiveDocContext = EMPTY_DOC_CONTEXT;

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

  function setDocContext(next: ActiveDocContext): void {
    if (
      next.format === currentDocContext.format &&
      next.section === currentDocContext.section &&
      next.docKind === currentDocContext.docKind &&
      next.feature === currentDocContext.feature &&
      next.approvalStatus === currentDocContext.approvalStatus
    ) {
      return;
    }
    currentDocContext = next;
    options.onDocContextChange?.(next);
    log.debug(
      () =>
        `docContext: format=${next.format} section=${next.section} docKind=${next.docKind} feature=${next.feature}`,
    );
  }

  function evaluate(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== "markdown") {
      setSprint(false);
      setSection(undefined);
      setDocContext(EMPTY_DOC_CONTEXT);
      return;
    }
    const fsPath = editor.document.uri.fsPath;
    // Widened precondition — admits docs/** AND .afx/** so the composer strip
    // can offer ADR / research / context actions in addition to spec/design/tasks.
    if (!fsPath.includes("/docs/") && !fsPath.includes("/.afx/")) {
      setSprint(false);
      setSection(undefined);
      setDocContext(EMPTY_DOC_CONTEXT);
      return;
    }
    const text = editor.document.getText();
    if (isSprintFile(text)) {
      setSprint(true);
      const cursorLine = editor.selection.active.line;
      const section = findSectionAt(text, cursorLine);
      setSection(section);
      const sprintSection = section === "SESSIONS" ? null : (section ?? null);
      setDocContext({
        format: "sprint",
        section: sprintSection,
        docKind: sprintSection
          ? sprintSection === "SPEC"
            ? "spec"
            : sprintSection === "DESIGN"
              ? "design"
              : "tasks"
          : null,
        feature: extractFeatureFromPath(fsPath, null),
        approvalStatus: extractSprintApprovalStatus(text, section),
      });
      return;
    }
    setSprint(false);
    setSection(undefined);
    const docKind = detectDocKind(fsPath, text);
    if (docKind) {
      setDocContext({
        format: "standard",
        section:
          docKind === "spec"
            ? "SPEC"
            : docKind === "design"
              ? "DESIGN"
              : docKind === "tasks"
                ? "TASKS"
                : null,
        docKind,
        feature: extractFeatureFromPath(fsPath, docKind),
        approvalStatus: extractFrontmatterStatus(text),
      });
      return;
    }
    setDocContext(EMPTY_DOC_CONTEXT);
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

/**
 * Extract the feature slug from a docs/specs/** path. Returns the *full* path
 * under `docs/specs/` (preserving group nesting), so:
 *   - `docs/specs/100-package-shared/spec.md` → `100-package-shared`
 *   - `docs/specs/chat-foundation/chat-foundation.md` → `chat-foundation`
 *   - `docs/specs/000-plans/plan-pi-hybrid-runtime.md` → `000-plans/plan-pi-hybrid-runtime`
 *
 * Returns null when the file lives outside `docs/specs/` (e.g. global
 * `docs/adr/**` or `docs/research/**`).
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
function extractFeatureFromPath(
  fsPath: string,
  docKind: ActiveDocContext["docKind"],
): string | null {
  const match = fsPath.match(/\/docs\/specs\/(.+)$/);
  const tail = match?.[1];
  if (!tail) return null;
  const segments = tail.split("/");
  if (segments.length < 2) return null;

  // Research / ADR docs nested inside a feature live under `<feature>/research/<file>.md`.
  // Walk up until we exit `/research/` and return the path leading up to it.
  if (docKind === "research" || docKind === "adr") {
    const researchIdx = segments.indexOf("research");
    if (researchIdx > 0) return segments.slice(0, researchIdx).join("/");
    return null;
  }

  // Default: parent directory of the file.
  return segments.slice(0, -1).join("/");
}

/**
 * Detect the AFX document kind for the given file path / contents. Filename
 * checks come first (cheap + canonical for spec/design/tasks/journal); path
 * patterns and frontmatter `type` cover ADRs and research files which can live
 * either at the workspace root (`docs/adr/**`, `docs/research/**`) or scoped to
 * a feature (`docs/specs/<feature>/research/**`).
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 */
function detectDocKind(fsPath: string, text: string): ActiveDocContext["docKind"] {
  // `.afx/context.md` is the canonical agent-handoff bundle for /afx-context.
  if (/\/\.afx\/context\.md$/.test(fsPath)) return "context";

  if (fsPath.endsWith("/spec.md")) return "spec";
  if (fsPath.endsWith("/design.md")) return "design";
  if (fsPath.endsWith("/tasks.md")) return "tasks";
  if (fsPath.endsWith("/journal.md")) return "journal";

  // Path patterns — global ADRs and research, or feature-scoped research dirs.
  if (/\/docs\/adr\//.test(fsPath)) return "adr";
  if (/\/docs\/research\//.test(fsPath)) return "research";

  // Feature-scoped research / ADR — `docs/specs/<feature>/research/<file>.md`.
  // Disambiguate by frontmatter `type` if present; otherwise default to research.
  if (/\/docs\/specs\/.+\/research\//.test(fsPath)) {
    const data = parseFrontmatter(text).data ?? {};
    const type = typeof data["type"] === "string" ? data["type"].toUpperCase() : "";
    if (type === "ADR") return "adr";
    return "research";
  }

  // Last-resort frontmatter check for misnamed but typed files.
  const data = parseFrontmatter(text).data ?? {};
  const type = typeof data["type"] === "string" ? data["type"].toUpperCase() : "";
  if (type === "CONTEXT") return "context";
  if (type === "JOURNAL") return "journal";
  if (type === "ADR") return "adr";
  if (type === "RES" || type === "RESEARCH") return "research";

  return null;
}

function extractFrontmatterStatus(text: string): string | null {
  const data = parseFrontmatter(text).data ?? {};
  const status = data["status"];
  return typeof status === "string" ? status : null;
}

function extractSprintApprovalStatus(
  text: string,
  section: SprintSection | undefined,
): string | null {
  const data = parseFrontmatter(text).data ?? {};
  const approval = data["approval"];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) return null;
  if (section === "SPEC") {
    const value = (approval as Record<string, unknown>)["spec"];
    return typeof value === "string" ? value : null;
  }
  if (section === "DESIGN") {
    const value = (approval as Record<string, unknown>)["design"];
    return typeof value === "string" ? value : null;
  }
  if (section === "TASKS") {
    const value = (approval as Record<string, unknown>)["tasks"];
    return typeof value === "string" ? value : null;
  }
  const status = data["status"];
  return typeof status === "string" ? status : null;
}

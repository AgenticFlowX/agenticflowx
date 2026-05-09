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
import * as fs from "node:fs";

import * as vscode from "vscode";

import { parseFrontmatter } from "@afx/parsers";
import type { FocusOption, Logger, PhaseRow, SignOffSummary, TaskItemRow } from "@afx/shared";

import { type FocusDocKind, parseFocuses } from "./focus-parser";
import { type SprintSection, findSectionAt, isSprintFile } from "./sprint";
import { summarizeTasksSignOff } from "./tasks-signoff";

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
  filePath: string | null;
  approvalStatus: string | null;
  taskPhases?: PhaseRow[];
  parsedFocuses?: FocusOption[];
  tasksCompleted?: number;
  tasksTotal?: number;
  /**
   * Composer-side Sign Off readiness — populated only for standard tasks.md so
   * the chat UI can decide whether to surface the brass `[Sign Off ▾]` button.
   * Sprint files keep this `undefined` because their Work Sessions table lives
   * in the SESSIONS slice; sprint sign-off is not in scope yet.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  signOff?: SignOffSummary;
  /**
   * Sibling-file frontmatter status for the workflow-position breadcrumb. Read
   * lazily from `<feature>/spec.md` / `design.md` / `tasks.md` and cached until
   * the file is saved. Sprint files derive these from the in-file `approval`
   * frontmatter so the breadcrumb still works.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
   */
  specStatus?: string | null;
  designStatus?: string | null;
  tasksStatus?: string | null;
}

const EMPTY_DOC_CONTEXT: ActiveDocContext = {
  format: null,
  section: null,
  docKind: null,
  feature: null,
  filePath: null,
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
      next.filePath === currentDocContext.filePath &&
      next.approvalStatus === currentDocContext.approvalStatus &&
      next.tasksCompleted === currentDocContext.tasksCompleted &&
      next.tasksTotal === currentDocContext.tasksTotal &&
      next.specStatus === currentDocContext.specStatus &&
      next.designStatus === currentDocContext.designStatus &&
      next.tasksStatus === currentDocContext.tasksStatus &&
      sameFocuses(next.parsedFocuses, currentDocContext.parsedFocuses) &&
      sameTaskPhases(next.taskPhases, currentDocContext.taskPhases) &&
      sameSignOff(next.signOff, currentDocContext.signOff)
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
    const docPath = normalizeDocPath(fsPath);
    // Widened precondition — admits docs/** AND .afx/** so the composer strip
    // can offer ADR / research / context actions in addition to spec/design/tasks.
    if (!docPath.includes("/docs/") && !docPath.includes("/.afx/")) {
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
      const docKind = sprintSection
        ? sprintSection === "SPEC"
          ? "spec"
          : sprintSection === "DESIGN"
            ? "design"
            : "tasks"
        : null;
      setDocContext(
        withSiblingStatuses(
          withTaskPhases(
            withParsedFocuses(
              {
                format: "sprint",
                section: sprintSection,
                docKind,
                feature: extractFeatureFromPath(docPath, null),
                filePath: fsPath,
                approvalStatus: extractSprintApprovalStatus(text, section),
              },
              parseSprintFocuses(text, section, docKind),
            ),
            parseSprintTaskSummary(text, section, docKind),
          ),
          extractSprintSiblingStatuses(text),
        ),
      );
      return;
    }
    setSprint(false);
    setSection(undefined);
    const docKind = detectDocKind(docPath, text);
    if (docKind) {
      setDocContext(
        withSiblingStatuses(
          withSignOff(
            withTaskPhases(
              withParsedFocuses(
                {
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
                  feature: extractFeatureFromPath(docPath, docKind),
                  filePath: fsPath,
                  approvalStatus: extractFrontmatterStatus(text),
                },
                parseFocuses(text, toFocusDocKind(docKind)),
              ),
              docKind === "tasks" ? parseTaskPhases(text) : null,
            ),
            docKind === "tasks" ? summarizeTasksSignOff(text) : null,
          ),
          readSiblingStatuses(deriveFeatureDir(fsPath, docKind)),
        ),
      );
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
        // Save invalidates both the active doc's payload AND the sibling cache —
        // the breadcrumb must reflect the new spec/design/tasks status without
        // waiting for the user to switch tabs.
        invalidateSiblingFrontmatterCache(doc.uri);
        const editor = vscode.window.activeTextEditor;
        if (editor) evaluate(editor);
      }),
    ],
  };
}

/**
 * Lazy sibling-frontmatter cache for the workflow-position breadcrumb.
 *
 * Active doc → derive feature directory → read `spec.md` / `design.md` /
 * `tasks.md` frontmatter once; cache keyed by file URI; invalidate on save
 * via `onDidSaveTextDocument` so the breadcrumb stays current when a sibling
 * is approved / refined / promoted in another tab.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
const siblingStatusCache = new Map<string, string | null>();

function invalidateSiblingFrontmatterCache(uri: vscode.Uri): void {
  siblingStatusCache.delete(uri.fsPath);
}

interface SiblingStatuses {
  spec: string | null;
  design: string | null;
  tasks: string | null;
}

function readSiblingStatuses(featureDir: string | null): SiblingStatuses {
  if (!featureDir) return { spec: null, design: null, tasks: null };
  return {
    spec: readSiblingStatus(featureDir, "spec.md"),
    design: readSiblingStatus(featureDir, "design.md"),
    tasks: readSiblingStatus(featureDir, "tasks.md"),
  };
}

function readSiblingStatus(featureDir: string, filename: string): string | null {
  const fullPath = `${featureDir}/${filename}`;
  if (siblingStatusCache.has(fullPath)) {
    return siblingStatusCache.get(fullPath) ?? null;
  }
  // Cheap synchronous read — sibling files are small and we only read three
  // of them per active-doc evaluation. Failing reads cache `null` so we don't
  // re-attempt on every selection-change tick.
  let status: string | null = null;
  try {
    if (fs.existsSync(fullPath)) {
      const text = fs.readFileSync(fullPath, "utf8");
      status = extractFrontmatterStatus(text);
    }
  } catch {
    /* swallow — null fallback is correct */
  }
  siblingStatusCache.set(fullPath, status);
  return status;
}

/**
 * Derive the canonical feature directory for the active editor. Used by the
 * sibling-frontmatter cache to locate spec.md / design.md / tasks.md regardless
 * of which one the user is currently editing. Returns null for sprint files
 * (where status comes from in-file `approval` frontmatter) and for files
 * outside `docs/specs/` (workspace ADR / research / context).
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
function deriveFeatureDir(fsPath: string, docKind: ActiveDocContext["docKind"]): string | null {
  if (docKind !== "spec" && docKind !== "design" && docKind !== "tasks") return null;
  const sep = fsPath.includes("\\") ? "\\" : "/";
  const lastSep = fsPath.lastIndexOf(sep);
  return lastSep === -1 ? null : fsPath.slice(0, lastSep);
}

function normalizeDocPath(fsPath: string): string {
  return fsPath.replace(/\\/g, "/");
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

function withParsedFocuses(ctx: ActiveDocContext, parsedFocuses: FocusOption[]): ActiveDocContext {
  if (parsedFocuses.length === 0) return ctx;
  return { ...ctx, parsedFocuses };
}

function withTaskPhases(ctx: ActiveDocContext, summary: TaskPhaseSummary | null): ActiveDocContext {
  if (!summary) return ctx;
  return {
    ...ctx,
    taskPhases: summary.phases,
    tasksCompleted: summary.completed,
    tasksTotal: summary.total,
  };
}

/**
 * Standard tasks.md keeps the Work Sessions table inside the same file, so we
 * reuse {@link summarizeTasksSignOff} verbatim. Sprint files keep the Work
 * Sessions table in a separate SESSIONS slice; sprint sign-off is intentionally
 * scoped out (Open Q on the fleeting sprint), so callers pass `null` there.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
function withSignOff(ctx: ActiveDocContext, signOff: SignOffSummary | null): ActiveDocContext {
  if (!signOff) return ctx;
  return { ...ctx, signOff };
}

/**
 * Attach sibling spec/design/tasks frontmatter status onto the bridge payload
 * so the chat strip-header breadcrumb can render `Spec ✓ → Design ⏳ → Tasks ·
 * → Code` without round-tripping to the host. Unknown statuses pass through
 * as `null` and the breadcrumb renders the segment as the default `·`.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
function withSiblingStatuses(ctx: ActiveDocContext, statuses: SiblingStatuses): ActiveDocContext {
  if (statuses.spec === null && statuses.design === null && statuses.tasks === null) {
    return ctx;
  }
  return {
    ...ctx,
    specStatus: statuses.spec,
    designStatus: statuses.design,
    tasksStatus: statuses.tasks,
  };
}

/**
 * Sprint files carry every section's approval state in the in-file `approval`
 * frontmatter block (Spec / Design / Tasks). Project that into the same
 * sibling-status shape the standard 4-file layout produces.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
function extractSprintSiblingStatuses(text: string): SiblingStatuses {
  const data = parseFrontmatter(text).data ?? {};
  const approval = data["approval"];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    return { spec: null, design: null, tasks: null };
  }
  const block = approval as Record<string, unknown>;
  const pick = (key: string): string | null => {
    const value = block[key];
    return typeof value === "string" && value.trim() ? value : null;
  };
  return { spec: pick("spec"), design: pick("design"), tasks: pick("tasks") };
}

function toFocusDocKind(docKind: ActiveDocContext["docKind"]): FocusDocKind | null {
  if (docKind === "spec" || docKind === "design" || docKind === "tasks") return docKind;
  return null;
}

function parseSprintFocuses(
  text: string,
  section: SprintSection | undefined,
  docKind: ActiveDocContext["docKind"],
): FocusOption[] {
  const focusKind = toFocusDocKind(docKind);
  if (!section || !focusKind) return [];
  const slice = extractSprintSection(text, section);
  if (!slice) return [];
  return parseFocuses(slice.text, focusKind, { lineOffset: slice.lineOffset });
}

type TaskPhaseSummary = {
  phases: PhaseRow[];
  total: number;
  completed: number;
};

function parseSprintTaskSummary(
  text: string,
  section: SprintSection | undefined,
  docKind: ActiveDocContext["docKind"],
): TaskPhaseSummary | null {
  if (section !== "TASKS" || docKind !== "tasks") return null;
  const slice = extractSprintSection(text, section);
  if (!slice) return null;
  return parseTaskPhases(slice.text, slice.lineOffset);
}

/**
 * Parse public afx-task template phase/task shape for the active editor bridge.
 * Phase headings follow `## Phase N: Name`; preferred task targets are
 * `### N.N Task group` headings, with their column-0 checkboxes used as
 * completion evidence. Older/simple task docs without group headings fall back
 * to treating phase-level checkboxes as WBS rows.
 *
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
function parseTaskPhases(text: string, lineOffset = 0): TaskPhaseSummary {
  const lines = text.split(/\r?\n/);
  const phases: PhaseRow[] = [];
  let current: PhaseRow | null = null;
  const phaseRe = /^##\s+Phase\s+(\d+):?\s*(.*)$/i;
  const groupRe = /^###\s+(\d+)\.(\d+)\s+(.+)$/;
  // Accept both `[ ]` (canonical) and `[]` (zero-char, common typo) as
  // unchecked. Without this, a `- [] Foo` row is silently dropped and the
  // surrounding group looks complete to the menu.
  const taskRe = /^-\s+\[([ xX]?)\]\s+(.+)$/;
  let activeGroup: {
    phase: PhaseRow;
    item: TaskItemRow;
    total: number;
    completed: number;
  } | null = null;

  function pushCurrent(next: PhaseRow): void {
    phases.push(next);
    activeGroup = null;
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const phaseMatch = phaseRe.exec(line);
    if (phaseMatch) {
      if (current) pushCurrent(current);
      const number = Number(phaseMatch[1]);
      current = {
        number,
        name: (phaseMatch[2] ?? "").trim() || `Phase ${number}`,
        completed: 0,
        total: 0,
        line: lineOffset + index + 1,
        items: [],
      };
      continue;
    }

    const groupMatch = groupRe.exec(line);
    if (groupMatch && current) {
      const phaseNumber = Number(groupMatch[1]);
      const taskNumber = Number(groupMatch[2]);
      const item: TaskItemRow = {
        text: (groupMatch[3] ?? "").trim(),
        completed: false,
        line: lineOffset + index + 1,
        wbsId: `${phaseNumber}.${taskNumber}`,
      };
      current.items.push(item);
      activeGroup = { phase: current, item, total: 0, completed: 0 };
      continue;
    }

    const taskMatch = taskRe.exec(line);
    if (!taskMatch || !current) continue;
    const isDone = taskMatch[1]?.toLowerCase() === "x";
    if (activeGroup?.phase === current) {
      activeGroup.total++;
      if (isDone) activeGroup.completed++;
      activeGroup.item.completed =
        activeGroup.total > 0 && activeGroup.completed === activeGroup.total;
      continue;
    }

    const item: TaskItemRow = {
      text: taskMatch[2] ?? "",
      completed: isDone,
      line: lineOffset + index + 1,
      wbsId: `${current.number}.${current.items.length + 1}`,
    };
    current.items.push(item);
  }

  if (current) pushCurrent(current);

  for (const phase of phases) {
    phase.total = phase.items.length;
    phase.completed = phase.items.filter((item) => item.completed).length;
  }

  return {
    phases,
    total: phases.reduce((sum, phase) => sum + phase.total, 0),
    completed: phases.reduce((sum, phase) => sum + phase.completed, 0),
  };
}

function extractSprintSection(
  text: string,
  section: SprintSection,
): { text: string; lineOffset: number } | null {
  const lines = text.split(/\r?\n/);
  const startMarker = `<!-- SPRINT-SECTION-START: ${section} -->`;
  const endMarker = `<!-- SPRINT-SECTION-END: ${section} -->`;
  const start = lines.findIndex((line) => line.trim() === startMarker);
  if (start === -1) return null;
  const end = lines.findIndex((line, index) => index > start && line.trim() === endMarker);
  if (end === -1) return null;
  return {
    text: lines.slice(start + 1, end).join("\n"),
    lineOffset: start + 1,
  };
}

function sameFocuses(left: FocusOption[] | undefined, right: FocusOption[] | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((focus, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      focus.id === other.id &&
      focus.label === other.label &&
      focus.slug === other.slug &&
      focus.commandSuffix === other.commandSuffix &&
      focus.line === other.line
    );
  });
}

function sameTaskPhases(left: PhaseRow[] | undefined, right: PhaseRow[] | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((phase, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      phase.number === other.number &&
      phase.name === other.name &&
      phase.completed === other.completed &&
      phase.total === other.total &&
      phase.line === other.line &&
      sameTaskItems(phase.items, other.items)
    );
  });
}

function sameTaskItems(left: TaskItemRow[], right: TaskItemRow[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      item.text === other.text &&
      item.completed === other.completed &&
      item.line === other.line &&
      item.wbsId === other.wbsId
    );
  });
}

function sameSignOff(left: SignOffSummary | undefined, right: SignOffSummary | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.ready === right.ready &&
    left.allTasksChecked === right.allTasksChecked &&
    left.allAgentVerified === right.allAgentVerified &&
    left.pendingHumanRows === right.pendingHumanRows &&
    left.alreadyLiving === right.alreadyLiving
  );
}

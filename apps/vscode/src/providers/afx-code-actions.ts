/**
 * AFX context-menu code actions — send selected code to the agent with AFX prompts.
 *
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-1] [FR-2]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-API]
 * @see docs/specs/215-app-chat-notes/spec.md [FR-3]
 * @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-MOCKUP-EDITOR] [DES-NOTES-FLOW]
 */
import * as vscode from "vscode";

import { type AgentManager, type Logger } from "@afx/shared";

import { isSprintFile } from "../services/sprint";
import { type EditorContext, getEditorContext } from "../utils/editor-utils";

export interface AfxCodeActionDispatch {
  /** Send immediately as a user message. */
  sendPrompt(prompt: string): Promise<void>;
  /** Append into the composer draft (no send). */
  appendDraft(content: string): Promise<void>;
  /** Save directly to .afx/notes.md without sending to the agent. */
  saveNote(content: string): Promise<void>;
}

/**
 * Where an action makes sense:
 * - any: always (Add to Context, Explain, Review, Verify Trace)
 * - code: code files only — anything that emits source edits or test scaffolding
 * - spec / design / tasks: scoped to that canonical file or to a sprint document
 *   (whose frontmatter declares type: SPRINT)
 */
type ActionScope = "any" | "code" | "spec" | "design" | "tasks" | "journal" | "adr" | "research";

type DispatchKind = "send" | "draft" | "note";

interface AfxAction {
  command: string;
  title: string;
  menuTitle: string;
  scope: ActionScope;
  dispatch: DispatchKind;
  prompt: (ctx: EditorContext) => string;
}

function displayPath(ctx: EditorContext): string {
  return ctx.relativePath ?? ctx.filePath;
}

function fenceLanguage(ctx: EditorContext): string {
  // Prefer short, markdown-friendly aliases for common VS Code language IDs.
  switch (ctx.languageId) {
    case "typescript":
      return "ts";
    case "typescriptreact":
      return "tsx";
    case "javascript":
      return "js";
    case "javascriptreact":
      return "jsx";
    case "markdown":
      return "md";
    case "json":
    case "jsonc":
      return "json";
    case "yaml":
      return "yaml";
    default:
      return ctx.languageId;
  }
}

function formatSelection(ctx: EditorContext): string {
  const path = displayPath(ctx);
  const header = `${path}:${ctx.startLine}-${ctx.endLine}`;
  const lang = fenceLanguage(ctx);
  return [header, `\`\`\`${lang}`, ctx.selectedText, "```"].join("\n");
}

function selectedTaskId(ctx: EditorContext): string {
  const match = ctx.selectedText.match(/\b\d+(?:\.\d+)+\b/);
  return match?.[0] ?? "";
}

function adrId(ctx: EditorContext): string {
  const filename = basename(ctx.filePath).replace(/\.md$/i, "");
  return filename || displayPath(ctx);
}

function hasFrontmatterType(doc: vscode.TextDocument, expected: string): boolean {
  return new RegExp(`^type:\\s*"?${expected}"?\\s*$`, "im").test(doc.getText());
}

function isAdrDoc(doc: vscode.TextDocument): boolean {
  const filename = basename(doc.uri.fsPath).toLowerCase();
  return (
    doc.languageId === "markdown" &&
    (doc.uri.fsPath.includes("/docs/adr/") ||
      filename.startsWith("adr-") ||
      hasFrontmatterType(doc, "ADR"))
  );
}

function isResearchDoc(doc: vscode.TextDocument): boolean {
  if (doc.languageId !== "markdown") return false;
  if (isAdrDoc(doc)) return false;
  return (
    doc.uri.fsPath.includes("/docs/research/") ||
    doc.uri.fsPath.includes("/research/") ||
    hasFrontmatterType(doc, "RES") ||
    hasFrontmatterType(doc, "RESEARCH")
  );
}

/**
 * Action registry: single source of truth for AFX editor actions. Each entry
 * declares command id, title, scope, dispatch mode, and prompt builder.
 *
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
 */
const ACTIONS: AfxAction[] = [
  // @see docs/specs/215-app-chat-notes/design.md [DES-NOTES-FLOW]
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-SAVE-TO-NOTES]
  {
    command: "afx.action.saveToNotes",
    title: "AgenticFlowX: Save to Notes",
    menuTitle: "Save to Notes",
    scope: "any",
    dispatch: "note",
    prompt: (c) => formatSelection(c),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-ADD-TO-CONTEXT]
  {
    command: "afx.action.addToContext",
    title: "AgenticFlowX: Insert into Composer",
    menuTitle: "Insert into Composer",
    scope: "any",
    dispatch: "draft",
    prompt: (c) => formatSelection(c),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-SEND-SELECTION]
  {
    command: "afx.action.sendSelection",
    title: "AgenticFlowX: Send Selection",
    menuTitle: "Send Selection",
    scope: "any",
    dispatch: "send",
    prompt: (c) => formatSelection(c),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-EXPLAIN]
  {
    command: "afx.action.explain",
    title: "AgenticFlowX: Explain",
    menuTitle: "Explain",
    scope: "any",
    dispatch: "send",
    prompt: (c) =>
      [
        "Explain the selection below clearly.",
        "- What it does and why it exists",
        "- Any non-obvious behavior, dependencies, or risks",
        "",
        formatSelection(c),
      ].join("\n"),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REVIEW]
  {
    command: "afx.action.review",
    title: "AgenticFlowX: Review",
    menuTitle: "Review",
    scope: "any",
    dispatch: "send",
    prompt: (c) =>
      [
        "Review the selection below.",
        "- Look for bugs, edge cases, and regressions",
        "- Note missing tests (and what to test)",
        "- Call out any traceability/documentation gaps",
        "",
        formatSelection(c),
      ].join("\n"),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-IMPROVE-CODE]
  {
    command: "afx.action.improveCode",
    title: "AgenticFlowX: Improve",
    menuTitle: "Improve",
    scope: "code",
    dispatch: "send",
    prompt: (c) =>
      [
        "Improve the code below while preserving behavior.",
        "- State the intended change(s) before editing",
        "- Keep the change set minimal and repo-consistent",
        "",
        formatSelection(c),
      ].join("\n"),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-GENERATE-TESTS]
  {
    command: "afx.action.generateTests",
    title: "AgenticFlowX: Generate Tests",
    menuTitle: "Generate Tests",
    scope: "code",
    dispatch: "send",
    prompt: (c) =>
      [
        "Generate or update focused tests for the code below.",
        "- Match this repo's test stack and style",
        "- Prefer small, high-signal cases over broad snapshots",
        "",
        formatSelection(c),
      ].join("\n"),
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-ADD-SEE-LINK]
  // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-COMMAND-ADD-LINK]
  {
    command: "afx.action.addSeeLink",
    title: "AgenticFlowX: Add @see Link",
    menuTitle: "Add @see Link",
    scope: "code",
    dispatch: "send",
    prompt: (c) =>
      [
        "Add a top-level JSDoc with @see link(s) to docs/specs/* (and design.md when relevant) for the selection below.",
        "- Use existing FR/NFR/DES anchors",
        "- Insert a new JSDoc block above the nearest exported symbol",
        "",
        formatSelection(c),
      ].join("\n"),
  },
  {
    // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-VERIFY-TRACE]
    // @see docs/specs/203-app-vscode-see-navigation/design.md [DES-SEE-COMMAND-VERIFY]
    command: "afx.action.verifyTrace",
    title: "AgenticFlowX: Verify Traceability",
    menuTitle: "Verify Traceability",
    scope: "any",
    dispatch: "send",
    prompt: (c) =>
      [
        `Run /afx-check trace ${displayPath(c)} — verify the selection traces back to spec/design via @see links and that referenced FR/NFR/DES anchors exist.`,
        "",
        formatSelection(c),
      ].join("\n"),
  },
  // ---- spec.md ----
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.specRefine",
    title: "AgenticFlowX: Spec — Refine",
    menuTitle: "Refine",
    scope: "spec",
    dispatch: "draft",
    prompt: (c) => `/afx-spec refine ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-SPEC-COMMAND-VALIDATE]
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-SPEC-VALIDATE]
  {
    command: "afx.action.specValidate",
    title: "AgenticFlowX: Spec — Validate",
    menuTitle: "Validate",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec validate ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-SPEC-COMMAND-REVIEW]
  {
    command: "afx.action.specReview",
    title: "AgenticFlowX: Spec — Review",
    menuTitle: "Review",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec review ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-SPEC-COMMAND-APPROVE]
  {
    command: "afx.action.specApprove",
    title: "AgenticFlowX: Spec — Approve",
    menuTitle: "Approve",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec approve ${c.filePath}`,
  },
  // ---- design.md ----
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.designRefine",
    title: "AgenticFlowX: Design — Refine",
    menuTitle: "Refine",
    scope: "design",
    dispatch: "draft",
    prompt: (c) => `/afx-design refine ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-DESIGN-COMMAND-VALIDATE]
  {
    command: "afx.action.designValidate",
    title: "AgenticFlowX: Design — Validate",
    menuTitle: "Validate",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design validate ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-DESIGN-COMMAND-REVIEW]
  {
    command: "afx.action.designReview",
    title: "AgenticFlowX: Design — Review",
    menuTitle: "Review",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design review ${c.filePath}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-DESIGN-COMMAND-APPROVE]
  {
    command: "afx.action.designApprove",
    title: "AgenticFlowX: Design — Approve",
    menuTitle: "Approve",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design approve ${c.filePath}`,
  },
  // ---- tasks.md ----
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-TASK-COMMAND-CODE]
  {
    command: "afx.action.taskCode",
    title: "AgenticFlowX: Task — Code",
    menuTitle: "Code",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) =>
      `/afx-task code ${c.filePath}${c.selectedText.trim() ? `\n\n${formatSelection(c)}` : ""}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-TASK-COMMAND-VERIFY]
  {
    command: "afx.action.taskVerify",
    title: "AgenticFlowX: Task — Verify",
    menuTitle: "Verify",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) =>
      `/afx-task verify ${c.filePath}${c.selectedText.trim() ? `\n\n${formatSelection(c)}` : ""}`,
  },
  // @see docs/specs/204-app-vscode-spec-services/design.md [DES-TASK-COMMAND-PICK]
  {
    command: "afx.action.taskPick",
    title: "AgenticFlowX: Task — Pick Next",
    menuTitle: "Pick Next",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) => `/afx-task pick ${c.filePath}`,
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.taskStatus",
    title: "AgenticFlowX: Task — Status",
    menuTitle: "Status",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) => `/afx-task status ${c.filePath}`,
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.taskBrief",
    title: "AgenticFlowX: Task — Brief",
    menuTitle: "Brief",
    scope: "tasks",
    dispatch: "draft",
    prompt: (c) => `/afx-task brief ${selectedTaskId(c)}`.trimEnd(),
  },
  // ---- journal.md ----
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.journalRecap",
    title: "AgenticFlowX: Journal — Recap",
    menuTitle: "Recap",
    scope: "journal",
    dispatch: "send",
    prompt: (c) => `/afx-session recap ${c.filePath}`,
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.journalPromote",
    title: "AgenticFlowX: Journal — Promote",
    menuTitle: "Promote",
    scope: "journal",
    dispatch: "draft",
    prompt: (c) => `/afx-session promote ${c.selectedText.trim()}`,
  },
  // ---- ADR ----
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.adrReview",
    title: "AgenticFlowX: ADR — Review",
    menuTitle: "Review",
    scope: "adr",
    dispatch: "send",
    prompt: (c) => `/afx-adr review ${adrId(c)}`,
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.adrList",
    title: "AgenticFlowX: ADR — List",
    menuTitle: "List",
    scope: "adr",
    dispatch: "send",
    prompt: () => "/afx-adr list",
  },
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.adrSupersede",
    title: "AgenticFlowX: ADR — Supersede",
    menuTitle: "Supersede",
    scope: "adr",
    dispatch: "draft",
    prompt: (c) => `/afx-adr supersede ${adrId(c)} `,
  },
  // Bundled afx-adr currently documents accept, so expose it as a draft-only
  // lifecycle mutation that the user can confirm before sending.
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.adrAccept",
    title: "AgenticFlowX: ADR — Accept",
    menuTitle: "Accept",
    scope: "adr",
    dispatch: "draft",
    prompt: (c) => `/afx-adr accept ${adrId(c)}`,
  },
  // ---- research ----
  // @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-REGISTRY]
  // @see docs/specs/211-app-chat-composer/spec.md [FR-15]
  {
    command: "afx.action.researchFinalize",
    title: "AgenticFlowX: Research — Finalize",
    menuTitle: "Finalize",
    scope: "research",
    dispatch: "draft",
    prompt: (c) => `/afx-research finalize ${c.filePath} --to `,
  },
];

function basename(fsPath: string): string {
  return fsPath.split(/[\\/]/).pop() ?? "";
}

/** Cheap precheck: only files in docs/specs/** can be sprints. */
function isSprintDoc(doc: vscode.TextDocument): boolean {
  if (doc.languageId !== "markdown") return false;
  if (!doc.uri.fsPath.includes("/docs/specs/")) return false;
  return isSprintFile(doc.getText());
}

function actionApplies(action: AfxAction, doc: vscode.TextDocument): boolean {
  const filename = basename(doc.uri.fsPath);
  const isMarkdown = doc.languageId === "markdown";
  switch (action.scope) {
    case "any":
      return true;
    case "code":
      return !isMarkdown;
    case "spec":
      return filename === "spec.md" || isSprintDoc(doc);
    case "design":
      return filename === "design.md" || isSprintDoc(doc);
    case "tasks":
      return filename === "tasks.md" || isSprintDoc(doc);
    case "journal":
      return filename === "journal.md";
    case "adr":
      return isAdrDoc(doc);
    case "research":
      return isResearchDoc(doc);
  }
}

export function createAfxCodeActionProvider(
  log: Logger,
  agentManager: AgentManager,
  dispatch?: AfxCodeActionDispatch,
): { disposables: vscode.Disposable[] } {
  // Flow: [EditorActions.Dispatch]
  const disposables: vscode.Disposable[] = [];

  for (const action of ACTIONS) {
    disposables.push(
      vscode.commands.registerCommand(action.command, async () => {
        const ctx = getEditorContext();
        if (!ctx) {
          vscode.window.showWarningMessage("AgenticFlowX: no active selection");
          return;
        }
        try {
          const prompt = action.prompt(ctx);
          if (action.dispatch === "note") {
            if (dispatch) {
              await dispatch.saveNote(prompt);
            } else {
              vscode.window.showWarningMessage(
                "AgenticFlowX: open the sidebar first to save notes",
              );
              return;
            }
            vscode.window.showInformationMessage("AgenticFlowX: Saved to notes");
          } else if (dispatch) {
            if (action.dispatch === "draft") {
              await dispatch.appendDraft(prompt);
            } else {
              await dispatch.sendPrompt(prompt);
            }
          } else if (action.dispatch === "send") {
            await vscode.commands.executeCommand("afx.openSidebar");
            await agentManager.send(prompt);
          } else {
            await vscode.commands.executeCommand("afx.openSidebar");
            vscode.window.showWarningMessage(
              "AgenticFlowX: cannot insert into composer (chat not ready) — open the sidebar and retry.",
            );
            return;
          }
          log.info(() => `dispatched ${action.command}`);
        } catch (err) {
          log.error(`${action.command} failed`, err instanceof Error ? err : undefined);
          vscode.window.showErrorMessage(
            `${action.title} failed — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }

  const provider: vscode.CodeActionProvider = {
    provideCodeActions(doc, _range): vscode.CodeAction[] {
      return ACTIONS.filter((a) => actionApplies(a, doc)).map((a) => {
        const action = new vscode.CodeAction(a.title, vscode.CodeActionKind.RefactorRewrite);
        action.command = { command: a.command, title: a.title };
        return action;
      });
    },
  };
  disposables.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: "typescript" },
        { language: "javascript" },
        { language: "typescriptreact" },
        { language: "javascriptreact" },
        { language: "markdown" },
        { language: "python" },
        { language: "go" },
      ],
      provider,
    ),
  );

  return { disposables };
}

/**
 * AFX context-menu code actions — send selected code to the agent with AFX prompts.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
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
}

/**
 * Where an action makes sense:
 * - any: always (Add to Context, Explain, Review, Verify Trace)
 * - code: code files only — anything that emits source edits or test scaffolding
 * - spec / design / tasks: scoped to that canonical file or to a sprint document
 *   (whose frontmatter declares type: SPRINT)
 */
type ActionScope = "any" | "code" | "spec" | "design" | "tasks";

type DispatchKind = "send" | "draft";

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

const ACTIONS: AfxAction[] = [
  {
    command: "afx.action.addToContext",
    title: "AgenticFlowX: Insert into Composer",
    menuTitle: "Insert into Composer",
    scope: "any",
    dispatch: "draft",
    prompt: (c) => formatSelection(c),
  },
  {
    command: "afx.action.sendSelection",
    title: "AgenticFlowX: Send Selection",
    menuTitle: "Send Selection",
    scope: "any",
    dispatch: "send",
    prompt: (c) => formatSelection(c),
  },
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
  {
    command: "afx.action.specValidate",
    title: "AgenticFlowX: Spec — Validate",
    menuTitle: "Validate",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec validate ${c.filePath}`,
  },
  {
    command: "afx.action.specReview",
    title: "AgenticFlowX: Spec — Review",
    menuTitle: "Review",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec review ${c.filePath}`,
  },
  {
    command: "afx.action.specApprove",
    title: "AgenticFlowX: Spec — Approve",
    menuTitle: "Approve",
    scope: "spec",
    dispatch: "send",
    prompt: (c) => `/afx-spec approve ${c.filePath}`,
  },
  // ---- design.md ----
  {
    command: "afx.action.designValidate",
    title: "AgenticFlowX: Design — Validate",
    menuTitle: "Validate",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design validate ${c.filePath}`,
  },
  {
    command: "afx.action.designReview",
    title: "AgenticFlowX: Design — Review",
    menuTitle: "Review",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design review ${c.filePath}`,
  },
  {
    command: "afx.action.designApprove",
    title: "AgenticFlowX: Design — Approve",
    menuTitle: "Approve",
    scope: "design",
    dispatch: "send",
    prompt: (c) => `/afx-design approve ${c.filePath}`,
  },
  // ---- tasks.md ----
  {
    command: "afx.action.taskCode",
    title: "AgenticFlowX: Task — Code",
    menuTitle: "Code",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) =>
      `/afx-task code ${c.filePath}${c.selectedText.trim() ? `\n\n${formatSelection(c)}` : ""}`,
  },
  {
    command: "afx.action.taskVerify",
    title: "AgenticFlowX: Task — Verify",
    menuTitle: "Verify",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) =>
      `/afx-task verify ${c.filePath}${c.selectedText.trim() ? `\n\n${formatSelection(c)}` : ""}`,
  },
  {
    command: "afx.action.taskPick",
    title: "AgenticFlowX: Task — Pick Next",
    menuTitle: "Pick Next",
    scope: "tasks",
    dispatch: "send",
    prompt: (c) => `/afx-task pick ${c.filePath}`,
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
  }
}

export function createAfxCodeActionProvider(
  log: Logger,
  agentManager: AgentManager,
  dispatch?: AfxCodeActionDispatch,
): { disposables: vscode.Disposable[] } {
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
          if (dispatch) {
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

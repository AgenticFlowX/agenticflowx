/**
 * Host-side tasks sign-off primitives for the spec-mode composer.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
import * as vscode from "vscode";

import type { SignOffSummary } from "@afx/shared";

export interface TasksSignOffDocument {
  uri: vscode.Uri;
  getText(): string;
}

export interface TasksSignOffResult {
  edit: vscode.WorkspaceEdit;
  summary: SignOffSummary;
  changed: boolean;
  signedOffRows: number;
  promotedStatus: boolean;
  bumpedUpdatedAt: boolean;
}

interface MutableWorkspaceEdit {
  replace(uri: vscode.Uri, range: vscode.Range, newText: string): void;
  insert(uri: vscode.Uri, position: vscode.Position, newText: string): void;
}

interface Cell {
  text: string;
  start: number;
  end: number;
}

interface WorkSessionRow {
  line: number;
  agentCell: Cell;
  humanCell: Cell;
}

interface FrontmatterInfo {
  endLine: number;
  statusLine?: number;
  status: string | null;
  updatedAtLine?: number;
}

/**
 * Parse the tasks markdown into the exact summary the composer needs for
 * Sign Off visibility.
 *
 * Two visibility gates:
 *
 * - `ready` — strict: every body `- [x]` AND every Work Sessions `Agent: [x]`
 *   AND at least one `Human: [ ]`. Drives the brass-tone styling and
 *   unblocks `status: Living` promotion in {@link buildTasksSignOffEdit}.
 * - `signable` — loose: at least one `Agent: [x] · Human: [ ]` row remains.
 *   Drives button visibility so users can sign off Human cells mid-flight.
 *   The popover surfaces `pendingTasks` / `pendingAgentRows` as warnings; the
 *   atomic edit still ticks the Human cells but does NOT promote status when
 *   the strict gate fails.
 */
export function summarizeTasksSignOff(rawTasks: string): SignOffSummary {
  const tasks = parseTaskCheckboxes(rawTasks);
  const rows = parseWorkSessionRows(rawTasks);
  const frontmatter = parseFrontmatterInfo(rawTasks);

  const allTasksChecked = tasks.total > 0 && tasks.completed === tasks.total;
  const allAgentVerified = rows.length > 0 && rows.every((row) => isChecked(row.agentCell.text));
  const pendingTasks = Math.max(0, tasks.total - tasks.completed);
  const pendingAgentRows = rows.filter((row) => !isChecked(row.agentCell.text)).length;
  const pendingHumanRows = rows.filter(
    (row) => isChecked(row.agentCell.text) && isUnchecked(row.humanCell.text),
  ).length;
  const alreadyLiving = /^Living$/i.test(frontmatter.status ?? "");

  return {
    ready: allTasksChecked && allAgentVerified && pendingHumanRows > 0,
    signable: pendingHumanRows > 0,
    allTasksChecked,
    allAgentVerified,
    pendingTasks,
    pendingAgentRows,
    pendingHumanRows,
    alreadyLiving,
  };
}

/**
 * Apply Sign Off to the active tasks document — wraps {@link buildTasksSignOffEdit}
 * with the live VS Code workspace edit + save lifecycle so the chat webview's
 * `chat/hostAction` `tasks.signOff` dispatch lands as a single undo entry on the
 * editor stack and persists immediately. Callers in tests or alternative hosts
 * can keep using {@link buildTasksSignOffEdit} directly.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-CHAT-PROTOCOL]
 */
export async function applyTasksSignOff(uri: vscode.Uri): Promise<{
  ok: boolean;
  rowsTicked: number;
  /**
   * Resulting frontmatter status. `"Living"` when Sign Off promoted (or the
   * file was already Living); otherwise the existing status verbatim from the
   * document — `tasks.md` canonically goes `Draft → Living` with no
   * `Approved` intermediate, so we never invent that label here.
   */
  newStatus: string;
  error?: string;
}> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(uri);
  } catch (err) {
    return {
      ok: false,
      rowsTicked: 0,
      newStatus: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const rawTasks = document.getText();
  const currentStatus = extractFrontmatterStatusValue(rawTasks);
  const result = buildTasksSignOffEdit({ uri, getText: () => rawTasks });
  if (!result.changed) {
    return {
      ok: true,
      rowsTicked: 0,
      newStatus: result.summary.alreadyLiving ? "Living" : currentStatus,
    };
  }

  try {
    const applied = await vscode.workspace.applyEdit(result.edit);
    if (!applied) {
      return { ok: false, rowsTicked: 0, newStatus: "", error: "Workspace edit was rejected" };
    }
    await document.save();
  } catch (err) {
    return {
      ok: false,
      rowsTicked: result.signedOffRows,
      newStatus: result.promotedStatus ? "Living" : currentStatus,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    ok: true,
    rowsTicked: result.signedOffRows,
    newStatus: result.promotedStatus ? "Living" : currentStatus,
  };
}

/** Read the raw frontmatter `status:` value, or empty string when absent. */
function extractFrontmatterStatusValue(rawTasks: string): string {
  return parseFrontmatterInfo(rawTasks).status ?? "";
}

/**
 * Build the single workspace edit used by the host Sign Off action. Callers can
 * pass a test edit double; production defaults to VS Code's undo-stack-aware edit.
 */
export function buildTasksSignOffEdit(
  document: TasksSignOffDocument,
  now: Date | string = new Date(),
  edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit(),
): TasksSignOffResult {
  const rawTasks = document.getText();
  const summary = summarizeTasksSignOff(rawTasks);
  const rows = parseWorkSessionRows(rawTasks);
  const frontmatter = parseFrontmatterInfo(rawTasks);
  const isoTimestamp = typeof now === "string" ? now : now.toISOString();
  const mutableEdit = edit as unknown as MutableWorkspaceEdit;

  let signedOffRows = 0;
  for (const row of rows) {
    if (!isChecked(row.agentCell.text) || !isUnchecked(row.humanCell.text)) continue;
    const replacement = tickFirstUncheckedMarker(row.humanCell.text);
    if (replacement === row.humanCell.text) continue;
    mutableEdit.replace(
      document.uri,
      new vscode.Range(
        new vscode.Position(row.line, row.humanCell.start),
        new vscode.Position(row.line, row.humanCell.end),
      ),
      replacement,
    );
    signedOffRows++;
  }

  // Status promotion is gated strictly on `summary.ready` — i.e. every body
  // checkbox AND every Agent cell must be verified. When the user signs off
  // mid-flight (relaxed mode), Human cells get ticked but the file stays at
  // its current status until the work is fully complete.
  const promotedStatus = signedOffRows > 0 && !summary.alreadyLiving && summary.ready;
  const bumpedUpdatedAt = signedOffRows > 0;
  if (signedOffRows > 0) {
    applyFrontmatterEdits(document.uri, mutableEdit, rawTasks, frontmatter, {
      status: promotedStatus ? "Living" : undefined,
      updatedAt: isoTimestamp,
    });
  }

  return {
    edit,
    summary,
    changed: signedOffRows > 0 || promotedStatus || bumpedUpdatedAt,
    signedOffRows,
    promotedStatus,
    bumpedUpdatedAt,
  };
}

function applyFrontmatterEdits(
  uri: vscode.Uri,
  edit: MutableWorkspaceEdit,
  rawTasks: string,
  frontmatter: FrontmatterInfo,
  values: { status?: string; updatedAt: string },
): void {
  const lines = rawTasks.split("\n");
  if (frontmatter.endLine < 0) return;

  const insertions: string[] = [];
  if (values.status && frontmatter.statusLine === undefined) {
    insertions.push(`status: ${values.status}`);
  }
  if (frontmatter.updatedAtLine === undefined) {
    insertions.push(`updated_at: ${values.updatedAt}`);
  }
  if (insertions.length > 0) {
    edit.insert(uri, new vscode.Position(frontmatter.endLine, 0), `${insertions.join("\n")}\n`);
  }

  if (values.status && frontmatter.statusLine !== undefined) {
    const line = lines[frontmatter.statusLine] ?? "";
    edit.replace(
      uri,
      wholeLineRange(frontmatter.statusLine, line),
      line.replace(/^(\s*status\s*:\s*).*/, `$1${values.status}`),
    );
  }

  if (frontmatter.updatedAtLine !== undefined) {
    const line = lines[frontmatter.updatedAtLine] ?? "";
    edit.replace(
      uri,
      wholeLineRange(frontmatter.updatedAtLine, line),
      line.replace(/^(\s*updated_at\s*:\s*).*/, `$1${values.updatedAt}`),
    );
  }
}

function parseFrontmatterInfo(rawTasks: string): FrontmatterInfo {
  const lines = rawTasks.split("\n");
  if (lines[0]?.trim() !== "---") return { endLine: -1, status: null };

  let endLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endLine = i;
      break;
    }
  }
  if (endLine < 0) return { endLine: -1, status: null };

  const info: FrontmatterInfo = { endLine, status: null };
  for (let i = 1; i < endLine; i++) {
    const line = lines[i] ?? "";
    const status = /^\s*status\s*:\s*(.+?)\s*$/.exec(line);
    if (status) {
      info.statusLine = i;
      info.status = stripYamlQuotes(status[1] ?? "");
      continue;
    }
    if (/^\s*updated_at\s*:/.test(line)) {
      info.updatedAtLine = i;
    }
  }
  return info;
}

function parseTaskCheckboxes(rawTasks: string): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  // Accept both `[ ]` (canonical) and `[]` (zero-char, common typo) as
  // unchecked. Without this, `allTasksChecked` reports `true` even when an
  // un-spaced empty checkbox is still on the page.
  for (const line of rawTasks.split("\n")) {
    const task = /^\s*-\s*\[([ xX]?)\]\s+/.exec(line);
    if (!task) continue;
    total++;
    if (task[1]?.toLowerCase() === "x") completed++;
  }
  return { total, completed };
}

/**
 * Lightweight Work Sessions row summary for the chat composer's Work Sessions
 * chip. Counts every data row in the `## Work Sessions` table and reports how
 * many have a ticked Human cell — surfaced as `n/m` next to the chip so the
 * user can see at a glance how much of the log has been signed off.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
 */
export function summarizeWorkSessions(rawTasks: string): {
  total: number;
  humanSigned: number;
} {
  const rows = parseWorkSessionRows(rawTasks);
  const humanSigned = rows.filter((row) => isChecked(row.humanCell.text)).length;
  return { total: rows.length, humanSigned };
}

function parseWorkSessionRows(rawTasks: string): WorkSessionRow[] {
  const rows: WorkSessionRow[] = [];
  const lines = rawTasks.split("\n");
  let inWorkSessions = false;
  let columns: { agent: number; human: number } | null = null;
  let sawSeparator = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s+(?:\d+\.\s+)?Work\s+Sessions\b/i.test(line)) {
      inWorkSessions = true;
      columns = null;
      sawSeparator = false;
      continue;
    }
    if (!inWorkSessions) continue;
    if (/^##\s+/.test(line)) break;
    if (!line.trim()) continue;
    if (!line.startsWith("|")) continue;

    const cells = parseTableCells(line);
    if (!columns) {
      const normalized = cells.map((cell) => cell.text.trim().toLowerCase());
      const agent = normalized.indexOf("agent");
      const human = normalized.indexOf("human");
      if (agent >= 0 && human >= 0) columns = { agent, human };
      continue;
    }
    if (!sawSeparator) {
      sawSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell.text.trim()));
      continue;
    }

    const agentCell = cells[columns.agent];
    const humanCell = cells[columns.human];
    if (!agentCell || !humanCell) continue;
    rows.push({ line: i, agentCell, humanCell });
  }

  return rows;
}

function parseTableCells(line: string): Cell[] {
  const cells: Cell[] = [];
  const pipePositions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "|") pipePositions.push(i);
  }
  for (let i = 0; i < pipePositions.length - 1; i++) {
    const start = (pipePositions[i] ?? 0) + 1;
    const end = pipePositions[i + 1] ?? line.length;
    cells.push({ text: line.slice(start, end), start, end });
  }
  return cells;
}

function tickFirstUncheckedMarker(cellText: string): string {
  return cellText.replace(/\[(?:\s)?\]/, "[x]");
}

function isChecked(value: string): boolean {
  return /\[[xX]\]/.test(value);
}

function isUnchecked(value: string): boolean {
  return /\[(?:\s)?\]/.test(value);
}

function stripYamlQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function wholeLineRange(line: number, text: string): vscode.Range {
  return new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, text.length));
}

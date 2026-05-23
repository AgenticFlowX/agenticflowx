/**
 * Markdown checkbox mutation helpers for Workbench and AFX Preview panels.
 * Used by the host to honour task/session toggles (`afxToggleTask`,
 * `afxToggleSession`, `afxToggleAllSessions`, `afxApproveSessions`) coming from
 * the Workbench feature tab and the standalone editor-area preview panel.
 *
 * @see docs/specs/227-app-workbench-shell/spec.md [FR-7]
 * @see docs/specs/227-app-workbench-shell/design.md [DES-API] [DES-SHELL-FEATURE-COLUMNS]
 * @see docs/specs/202-app-vscode-editor-actions/spec.md [FR-6]
 * @see docs/specs/202-app-vscode-editor-actions/design.md [DES-ACTION-PREVIEW-PANEL]
 * @see docs/specs/100-package-shared/spec.md [FR-4]
 * @see docs/specs/100-package-shared/design.md [DES-SHARED-WORKBENCH-PROTOCOL]
 */

const CHECKBOX_MARKER_RE = /\[(?: |x|X)?\]/;
const CHECKED_MARKER_RE = /\[[xX]\]/;
const UNCHECKED_MARKER_RE = /\[(?:\s)?\]/;
const WORK_SESSIONS_HEADING_RE = /^##\s+(?:\d+\.\s+)?(?:Work\s+Sessions|Sessions)\b/i;

interface WorkSessionColumns {
  agent: number;
  human: number;
}

interface WorkSessionMutationContext {
  rowIndex: number;
  columns: WorkSessionColumns;
}

function marker(completed: boolean): string {
  return completed ? "[x]" : "[ ]";
}

function splitTableCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function workSessionColumns(line: string): WorkSessionColumns | null {
  const cells = splitTableCells(line).map((cell) => cell.toLowerCase());
  const agent = cells.indexOf("agent");
  const human = cells.indexOf("human");
  if (agent < 0 || human < 0) return null;
  return { agent, human };
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * Toggle the first markdown checkbox marker on a 1-based source line. Supports
 * both spaced `[ ]` and compact `[]` unchecked markers.
 */
export function toggleMarkdownCheckboxLine(text: string, line: number, completed: boolean): string {
  const lines = text.split("\n");
  const index = line - 1;
  if (index < 0 || index >= lines.length) return text;

  const current = lines[index] ?? "";
  const next = current.replace(CHECKBOX_MARKER_RE, marker(completed));
  if (next === current) return text;

  lines[index] = next;
  return lines.join("\n");
}

/**
 * Toggle an Agent/Human checkbox in the Work Sessions markdown table.
 */
export function toggleWorkSessionCheckbox(
  text: string,
  sessionIndex: number,
  column: "agent" | "human",
  completed: boolean,
): string {
  return mutateWorkSessionRows(text, (parts, context) => {
    if (context.rowIndex !== sessionIndex) return false;
    return replaceSessionCell(parts, context.columns[column], completed);
  });
}

/**
 * Toggle an Agent/Human checkbox on an exact 1-based source line. This is the
 * preview path: it avoids row-index drift after markdown cleanup/normalization.
 */
export function toggleWorkSessionCheckboxLine(
  text: string,
  line: number,
  column: "agent" | "human",
  completed: boolean,
): string {
  const lines = text.split("\n");
  const index = line - 1;
  if (index < 0 || index >= lines.length) return text;

  const columns = findWorkSessionColumnsForLine(lines, index);
  if (!columns) return text;

  const parts = (lines[index] ?? "").split("|");
  const requiredParts = Math.max(columns.agent, columns.human) + 2;
  if (parts.length < requiredParts) return text;
  if (!replaceSessionCell(parts, columns[column], completed)) return text;

  lines[index] = parts.join("|");
  return lines.join("\n");
}

/**
 * Toggle every Agent or Human checkbox in the Work Sessions table.
 */
export function toggleAllWorkSessionCheckboxes(
  text: string,
  column: "agent" | "human",
  completed: boolean,
): string {
  return mutateWorkSessionRows(text, (parts, context) =>
    replaceSessionCell(parts, context.columns[column], completed),
  );
}

/**
 * Approve every Agent-verified Work Sessions row by checking its Human cell.
 */
export function approveWorkSessionCheckboxes(text: string): string {
  return mutateWorkSessionRows(text, (parts, context) => {
    const agentCell = parts[context.columns.agent + 1] ?? "";
    const humanCell = parts[context.columns.human + 1] ?? "";
    if (!CHECKED_MARKER_RE.test(agentCell) || !UNCHECKED_MARKER_RE.test(humanCell)) {
      return false;
    }
    return replaceSessionCell(parts, context.columns.human, true);
  });
}

function mutateWorkSessionRows(
  text: string,
  mutate: (parts: string[], context: WorkSessionMutationContext) => boolean,
): string {
  const lines = text.split("\n");
  let inWorkSessions = false;
  let columns: WorkSessionColumns | null = null;
  let pastHeader = false;
  let rowIndex = 0;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (WORK_SESSIONS_HEADING_RE.test(trimmed)) {
      inWorkSessions = true;
      columns = null;
      pastHeader = false;
      rowIndex = 0;
      continue;
    }
    if (inWorkSessions && /^##\s+/.test(trimmed)) break;
    if (!inWorkSessions && !workSessionColumns(line)) continue;
    if (!trimmed) continue;
    if (!trimmed.startsWith("|")) {
      if (inWorkSessions && pastHeader) break;
      continue;
    }

    if (!columns) {
      columns = workSessionColumns(line);
      if (columns) inWorkSessions = true;
      continue;
    }
    if (isTableSeparator(line)) {
      pastHeader = true;
      continue;
    }
    if (!pastHeader) continue;

    const parts = line.split("|");
    const requiredParts = Math.max(columns.agent, columns.human) + 2;
    if (parts.length < requiredParts) continue;

    const rowChanged = mutate(parts, { rowIndex, columns });
    if (rowChanged) {
      lines[i] = parts.join("|");
      changed = true;
    }
    rowIndex++;
  }

  return changed ? lines.join("\n") : text;
}

function replaceSessionCell(parts: string[], cellIndex: number, completed: boolean): boolean {
  const partIndex = cellIndex + 1;
  const current = parts[partIndex] ?? "";
  const next = current.replace(CHECKBOX_MARKER_RE, marker(completed));
  if (next === current) return false;

  parts[partIndex] = next;
  return true;
}

function findWorkSessionColumnsForLine(
  lines: string[],
  rowIndex: number,
): WorkSessionColumns | null {
  for (let i = rowIndex - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed) && !WORK_SESSIONS_HEADING_RE.test(trimmed)) return null;
    const columns = workSessionColumns(line);
    if (columns) return columns;
  }
  return null;
}

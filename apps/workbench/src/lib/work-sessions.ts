/**
 * Work Sessions table parsing for preview toolbars and signoff actions.
 *
 * @see docs/specs/222-app-workbench-documents/spec.md [FR-7] [FR-9]
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
import { cleanMarkdownForReading } from "./markdown-cleanup";
import { isMarkdownTableSeparator, splitMarkdownTableCells } from "./markdown-table";

const WORK_SESSIONS_HEADING_RE = /^##\s+(?:\d+\.\s+)?(?:Work\s+Sessions|Sessions)\b/i;

interface WorkSessionColumns {
  agent: number;
  human: number;
}

export interface ParsedWorkSessionRow {
  agent: boolean;
  human: boolean;
}

export interface WorkSessionSignoffSummary {
  total: number;
  agentChecked: number;
  humanChecked: number;
  approvable: number;
}

export function summarizeWorkSessionSignoffs(content: string): WorkSessionSignoffSummary | null {
  const rows = parseWorkSessionRows(content);
  if (rows.length === 0) return null;

  const agentChecked = rows.filter((row) => row.agent).length;
  const humanChecked = rows.filter((row) => row.human).length;
  const approvable = rows.filter((row) => row.agent && !row.human).length;
  return {
    total: rows.length,
    agentChecked,
    humanChecked,
    approvable,
  };
}

export function parseWorkSessionRows(content: string): ParsedWorkSessionRow[] {
  const lines = cleanMarkdownForReading(content).split("\n");
  const rows: ParsedWorkSessionRow[] = [];
  let inSection = false;
  let columns: WorkSessionColumns | null = null;
  let pastSeparator = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (WORK_SESSIONS_HEADING_RE.test(trimmed)) {
      inSection = true;
      columns = null;
      pastSeparator = false;
      continue;
    }
    if (inSection && /^##\s+/.test(trimmed)) break;
    if (!inSection && !looksLikeWorkSessionsHeader(line)) continue;
    if (!trimmed.startsWith("|")) {
      if (inSection && pastSeparator && rows.length > 0) break;
      continue;
    }

    if (!columns) {
      columns = workSessionColumns(line);
      if (columns) inSection = true;
      continue;
    }
    if (!pastSeparator) {
      pastSeparator = isMarkdownTableSeparator(line);
      continue;
    }

    const cells = splitMarkdownTableCells(line);
    const agent = checkboxCellState(cells[columns.agent] ?? "");
    const human = checkboxCellState(cells[columns.human] ?? "");
    if (agent === null || human === null) continue;
    rows.push({ agent, human });
  }

  return rows;
}

function looksLikeWorkSessionsHeader(line: string): boolean {
  return workSessionColumns(line) !== null;
}

function workSessionColumns(line: string): WorkSessionColumns | null {
  const cells = splitMarkdownTableCells(line).map((cell) => cell.toLowerCase());
  const agent = cells.indexOf("agent");
  const human = cells.indexOf("human");
  if (agent < 0 || human < 0) return null;
  return { agent, human };
}

function checkboxCellState(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "[x]") return true;
  if (normalized === "[ ]" || normalized === "[]") return false;
  return null;
}

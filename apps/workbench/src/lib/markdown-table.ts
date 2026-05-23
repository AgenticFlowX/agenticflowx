/**
 * Markdown table helpers for AFX reader surfaces.
 *
 * AFX-generated docs lean heavily on pipe tables for requirements, decisions,
 * file maps, task indexes, and Work Sessions. This module keeps that grammar
 * named and centralized so renderer changes can target a real block type
 * instead of anonymous table CSS.
 *
 * @see docs/specs/222-app-workbench-documents/design.md [DES-DOCS-MARKDOWN]
 */
import { type MarkdownFence, nextMarkdownFence } from "./markdown-fence";

export type MarkdownTableKind =
  | "requirements"
  | "work-sessions"
  | "decisions"
  | "file-map"
  | "cross-reference"
  | "open-questions"
  | "generic";

function firstNonSpace(line: string): string {
  return line.trimStart()[0] ?? "";
}

function lastNonSpace(line: string): string {
  const trimmed = line.trimEnd();
  return trimmed[trimmed.length - 1] ?? "";
}

/**
 * Split a pipe-table row while respecting escaped pipes and inline code spans.
 */
export function splitMarkdownTableCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let codeFence = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i] ?? "";
    const next = line[i + 1] ?? "";

    if (char === "\\" && next) {
      current += char + next;
      i++;
      continue;
    }

    if (char === "`") {
      let j = i;
      while (line[j] === "`") j++;
      const ticks = line.slice(i, j);
      if (!codeFence) {
        codeFence = ticks;
      } else if (ticks === codeFence) {
        codeFence = "";
      }
      current += ticks;
      i = j - 1;
      continue;
    }

    if (char === "|" && !codeFence) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  if (firstNonSpace(line) === "|" && cells[0] === "") cells.shift();
  if (lastNonSpace(line) === "|" && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

export function isMarkdownTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownTableCells(line).length >= 2;
}

export function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function tableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function normalizeCells(cells: string[], targetCount: number): string[] {
  if (targetCount <= 0) return cells;
  if (cells.length > targetCount) {
    return [...cells.slice(0, targetCount - 1), cells.slice(targetCount - 1).join(" | ")];
  }
  if (cells.length < targetCount) {
    return [...cells, ...Array.from({ length: targetCount - cells.length }, () => "")];
  }
  return cells;
}

function normalizeSeparator(targetCount: number): string {
  return tableRow(Array.from({ length: targetCount }, () => "---"));
}

function fallbackHeader(targetCount: number): string[] {
  return Array.from({ length: targetCount }, (_, index) => `Column ${index + 1}`);
}

/**
 * Repair common loose/malformed AFX tables before remark-gfm sees them:
 * blank lines after separators, separator/header count drift, and rows with
 * unescaped extra pipes. Fenced code blocks are left untouched.
 */
export function normalizeMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let fence: MarkdownFence | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const nextFence = nextMarkdownFence(line, fence);
    if (nextFence !== fence) {
      fence = nextFence;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }

    const next = lines[i + 1] ?? "";
    if (isMarkdownTableSeparator(line) && isMarkdownTableRow(next)) {
      const targetCount = splitMarkdownTableCells(line).length;
      out.push(tableRow(fallbackHeader(targetCount)));
      out.push(normalizeSeparator(targetCount));

      for (let j = i + 1; j < lines.length; j++) {
        const row = lines[j] ?? "";
        const rowTrimmed = row.trim();
        if (!rowTrimmed) {
          i = j - 1;
          break;
        }
        if (!isMarkdownTableRow(row)) {
          i = j - 1;
          break;
        }
        out.push(tableRow(normalizeCells(splitMarkdownTableCells(row), targetCount)));
        i = j;
      }
      continue;
    }

    if (!isMarkdownTableRow(line) || !isMarkdownTableSeparator(next)) {
      out.push(line);
      continue;
    }

    const headerCells = splitMarkdownTableCells(line);
    const targetCount = headerCells.length;
    out.push(tableRow(normalizeCells(headerCells, targetCount)));
    out.push(normalizeSeparator(targetCount));
    i++;

    for (let j = i + 1; j < lines.length; j++) {
      const row = lines[j] ?? "";
      const rowTrimmed = row.trim();
      if (!rowTrimmed) {
        let nextRowIndex = j + 1;
        while (nextRowIndex < lines.length && !(lines[nextRowIndex] ?? "").trim()) {
          nextRowIndex++;
        }
        if (nextRowIndex < lines.length && isMarkdownTableRow(lines[nextRowIndex] ?? "")) {
          if (isMarkdownTableSeparator(lines[nextRowIndex + 1] ?? "")) {
            i = j - 1;
            break;
          }
          j = nextRowIndex - 1;
          continue;
        }
        i = j - 1;
        break;
      }
      if (!isMarkdownTableRow(row)) {
        i = j - 1;
        break;
      }
      out.push(tableRow(normalizeCells(splitMarkdownTableCells(row), targetCount)));
      i = j;
    }
  }

  return out.join("\n");
}

export function classifyRenderedTableText(text: string): MarkdownTableKind {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  if (
    normalized.includes("date") &&
    normalized.includes("task") &&
    normalized.includes("files modified") &&
    normalized.includes("agent") &&
    normalized.includes("human")
  ) {
    return "work-sessions";
  }
  if (
    normalized.includes("id") &&
    normalized.includes("requirement") &&
    (normalized.includes("priority") || normalized.includes("target"))
  ) {
    return "requirements";
  }
  if (
    normalized.includes("decision") &&
    normalized.includes("options considered") &&
    normalized.includes("choice")
  ) {
    return "decisions";
  }
  if (normalized.includes("file") && normalized.includes("purpose")) return "file-map";
  if (
    normalized.includes("task") &&
    normalized.includes("spec requirement") &&
    normalized.includes("design section")
  ) {
    return "cross-reference";
  }
  if (
    normalized.includes("question") &&
    normalized.includes("status") &&
    normalized.includes("resolution")
  ) {
    return "open-questions";
  }
  return "generic";
}

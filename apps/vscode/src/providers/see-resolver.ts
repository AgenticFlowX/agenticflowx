/**
 * Shared resolver for `@see docs/...` annotations — extracts the file path and
 * bracket node IDs (`[FR-X]`, `[NFR-X]`, `[DES-XXX]`, `[X.Y]`) on a single line,
 * resolves them against the workspace, and locates the matching line inside the
 * referenced markdown file.
 *
 * @see docs/specs/200-app-vscode/spec.md [FR-3] [FR-4]
 * @see docs/specs/200-app-vscode/design.md [DES-ARCH]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as vscode from "vscode";

const SEE_PATH_RE = /@see\s+(docs\/[A-Za-z0-9_/.+-]+\.md)/;
const PATH_TOKEN_RE = /docs\/[A-Za-z0-9_/.+-]+\.md/;
const NODE_ID_RE = /\[([A-Z]+(?:-[A-Z0-9-]+)?|\d+\.\d+)\]/g;
const tableRowReTemplate = (id: string): RegExp =>
  new RegExp(`^\\|\\s*${escapeRegExp(id)}\\s*\\|`, "m");

export interface SeeContext {
  /** Cursor target — which token kind the user is hovering / clicking on. */
  kind: "path" | "node";
  /** Workspace-relative spec path (always present when match succeeds). */
  relPath: string;
  /** Absolute path to the spec file. */
  absPath: string;
  /** Whether the file actually exists on disk. */
  exists: boolean;
  /** Range of the cursor token within the source document. */
  tokenRange: vscode.Range;
  /** Node id (only for kind === "node"), e.g. "FR-6", "DES-ARCH", "2.1". */
  nodeId?: string;
}

export interface ResolvedNode {
  /** Zero-indexed line of the heading or table row that matches the node id. */
  line: number;
  /** Raw line text (or the heading + body chunk for headings). */
  excerpt: string;
  /** Raw column headers when matched against a markdown table. */
  tableHeaders?: string[];
  /** Raw cell values (excluding the leading id) when matched against a table. */
  tableCells?: string[];
}

/**
 * Inspect the line under the cursor and, if it carries an `@see docs/...` annotation,
 * report which token the cursor is currently on.
 */
export function getSeeContextAt(
  document: vscode.TextDocument,
  position: vscode.Position,
  root: string,
): SeeContext | undefined {
  const line = document.lineAt(position.line);
  const lineText = line.text;
  const seeMatch = SEE_PATH_RE.exec(lineText);
  if (!seeMatch) return undefined;

  const relPath = seeMatch[1];
  if (!relPath) return undefined;
  const absPath = join(root, relPath);
  const exists = existsSync(absPath);
  const lineOffset = document.offsetAt(new vscode.Position(position.line, 0));

  // Cursor on the path token?
  const pathTokenMatch = PATH_TOKEN_RE.exec(lineText);
  if (pathTokenMatch) {
    const start = pathTokenMatch.index;
    const end = start + pathTokenMatch[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        kind: "path",
        relPath,
        absPath,
        exists,
        tokenRange: new vscode.Range(
          document.positionAt(lineOffset + start),
          document.positionAt(lineOffset + end),
        ),
      };
    }
  }

  // Cursor on a [Node-Id] bracket? Walk all bracket matches on the line.
  const re = new RegExp(NODE_ID_RE.source, NODE_ID_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        kind: "node",
        relPath,
        absPath,
        exists,
        nodeId: m[1],
        tokenRange: new vscode.Range(
          document.positionAt(lineOffset + start),
          document.positionAt(lineOffset + end),
        ),
      };
    }
  }

  return undefined;
}

export interface NodeIdEntry {
  id: string;
  kind: "fr" | "nfr" | "des" | "task";
  /** First-cell description (table) or heading text — used as completion detail. */
  detail?: string;
  /** Zero-indexed line of the matched row/heading. */
  line: number;
}

/**
 * Scan a markdown file and return every node id we know how to address — table
 * rows for `FR-X`/`NFR-X` and headings for `DES-XXX` / `X.Y` task ids.
 */
export function listNodeIds(absPath: string): NodeIdEntry[] {
  if (!existsSync(absPath)) return [];
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n");
  const out: NodeIdEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const tableMatch = /^\|\s*((?:FR|NFR)-\d+)\s*\|\s*(.+?)\s*\|/i.exec(line);
    if (tableMatch) {
      const id = tableMatch[1] ?? "";
      const detail = tableMatch[2] ?? "";
      out.push({
        id,
        kind: id.toUpperCase().startsWith("NFR") ? "nfr" : "fr",
        detail,
        line: i,
      });
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    const headingText = headingMatch?.[2];
    if (!headingText) continue;

    const desMatch = /\b(DES-[A-Z][A-Z0-9-]*)/.exec(headingText);
    if (desMatch) {
      out.push({ id: desMatch[1] ?? "", kind: "des", detail: headingText, line: i });
      continue;
    }
    const taskMatch = /^(\d+\.\d+)\b/.exec(headingText);
    if (taskMatch) {
      out.push({ id: taskMatch[1] ?? "", kind: "task", detail: headingText, line: i });
    }
  }

  return out;
}

/**
 * Read the spec file from disk and locate the line that defines `nodeId`.
 *
 * Resolution strategy:
 * - `FR-X` / `NFR-X` → table row whose first cell matches the id.
 * - `DES-XXX` → first heading (any level) whose slug contains `des-xxx`.
 * - `X.Y` → first heading (any level) whose text starts with `X.Y`.
 */
export function resolveNode(absPath: string, nodeId: string): ResolvedNode | undefined {
  if (!existsSync(absPath)) return undefined;
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return undefined;
  }

  const lines = content.split("\n");

  if (/^(FR|NFR)-\d+/i.test(nodeId)) {
    const rowRe = tableRowReTemplate(nodeId);
    for (let i = 0; i < lines.length; i++) {
      if (rowRe.test(lines[i] ?? "")) {
        const headers = findTableHeaders(lines, i);
        const cells = splitTableRow(lines[i] ?? "");
        return {
          line: i,
          excerpt: lines[i] ?? "",
          tableHeaders: headers,
          tableCells: cells.slice(1),
        };
      }
    }
  }

  if (/^DES-/i.test(nodeId)) {
    const target = nodeId.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i] ?? "");
      const headingPrefix = heading?.[1];
      const headingText = heading?.[2];
      if (!headingPrefix || !headingText) continue;
      const slug = headingText
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .replace(/^-|-$/g, "");
      if (slug === target || slug.includes(target)) {
        return { line: i, excerpt: extractHeadingBlock(lines, i, headingPrefix.length) };
      }
    }
  }

  if (/^\d+\.\d+$/.test(nodeId)) {
    for (let i = 0; i < lines.length; i++) {
      const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i] ?? "");
      const headingPrefix = heading?.[1];
      const headingText = heading?.[2];
      if (!headingPrefix || !headingText) continue;
      if (headingText.startsWith(nodeId)) {
        return { line: i, excerpt: extractHeadingBlock(lines, i, headingPrefix.length) };
      }
    }
  }

  return undefined;
}

/**
 * Extract a short preview of the file (first 40 lines, frontmatter skipped) for
 * path-target hover popups.
 */
export function readPathPreview(
  absPath: string,
): { content: string; truncated: boolean } | undefined {
  if (!existsSync(absPath)) return undefined;
  let raw: string;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch {
    return undefined;
  }
  const lines = raw.split("\n");
  let start = 0;
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === "---") {
        start = i + 1;
        break;
      }
    }
  }
  const max = 40;
  const slice = lines
    .slice(start, start + max)
    .join("\n")
    .trim();
  return { content: slice, truncated: lines.length - start > max };
}

function findTableHeaders(lines: string[], rowIdx: number): string[] | undefined {
  // A markdown table is: header row | separator row | body rows. Walk back for the closest
  // header row that precedes the matched body row through a separator.
  let sawSeparator = false;
  for (let i = rowIdx - 1; i >= 0; i--) {
    const text = lines[i] ?? "";
    if (!text.trim().startsWith("|")) break;
    if (/^\|\s*[-:]+/.test(text)) {
      sawSeparator = true;
      continue;
    }
    if (sawSeparator) {
      return splitTableRow(text);
    }
  }
  return undefined;
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function extractHeadingBlock(lines: string[], startIdx: number, level: number): string {
  const out: string[] = [lines[startIdx] ?? ""];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const heading = /^(#{1,6})\s+/.exec(lines[i] ?? "");
    const headingLevel = heading?.[1]?.length;
    if (headingLevel !== undefined && headingLevel <= level) break;
    out.push(lines[i] ?? "");
    if (out.length >= 30) break;
  }
  return out.join("\n").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

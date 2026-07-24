/**
 * Lossless parser and source-range mutation engine for AFX Markdown boards.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-5] [FR-8] [FR-14] [NFR-3] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] [DES-BOARD-PORTABLE-LINK]
 */
import { createHash } from "node:crypto";

export interface KanbanSourceIdentity {
  rootUri: string;
  rootName: string;
  relativePath: string;
}

export type KanbanLinkedWorkItemRef =
  | {
      version: 1;
      kind: "spec";
      source: KanbanSourceIdentity;
    }
  | {
      version: 1;
      kind: "task";
      source: KanbanSourceIdentity;
      wbsId: string;
    };

export interface KanbanMarkdownCard {
  id: string;
  text: string;
  start: number;
  end: number;
  kind: "list" | "heading";
  link?: KanbanLinkedWorkItemRef;
}

export interface KanbanMarkdownColumn {
  id: string;
  title: string;
  start: number;
  headingEnd: number;
  end: number;
  cards: KanbanMarkdownCard[];
}

export interface KanbanMarkdownDocument {
  content: string;
  newline: "\n" | "\r\n";
  columns: KanbanMarkdownColumn[];
  boardRulesStart?: number;
  error?: string;
}

export type KanbanMarkdownMutation =
  | { kind: "addColumn"; title: string }
  | { kind: "renameColumn"; columnId: string; title: string }
  | { kind: "deleteColumn"; columnId: string }
  | {
      kind: "addCard";
      columnId: string;
      text: string;
      link?: KanbanLinkedWorkItemRef;
      beforeCardId?: string;
    }
  | { kind: "editCard"; cardId: string; text: string }
  | { kind: "deleteCard"; cardId: string }
  | { kind: "moveCard"; cardId: string; toColumnId: string; beforeCardId?: string }
  | { kind: "moveColumn"; columnId: string; beforeColumnId?: string };

export type KanbanMutationOutcome =
  | { ok: true; content: string }
  | { ok: false; reason: "invalid" | "missing" | "ambiguous"; message: string };

interface LineSpan {
  start: number;
  contentEnd: number;
  end: number;
  text: string;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function linesWithOffsets(content: string): LineSpan[] {
  const lines: LineSpan[] = [];
  const re = /.*?(?:\r\n|\n|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content))) {
    const raw = match[0];
    if (!raw) break;
    const newlineLength = raw.endsWith("\r\n") ? 2 : raw.endsWith("\n") ? 1 : 0;
    lines.push({
      start: match.index,
      contentEnd: match.index + raw.length - newlineLength,
      end: match.index + raw.length,
      text: raw.slice(0, raw.length - newlineLength),
    });
  }
  return lines;
}

function trimTrailingBlankStart(lines: LineSpan[], fromIndex: number, endIndex: number): number {
  let cursor = endIndex;
  while (cursor > fromIndex && !lines[cursor - 1]?.text.trim()) cursor--;
  return cursor;
}

function markdownHeadingEligibility(lines: LineSpan[]): boolean[] {
  let fence: { marker: "`" | "~"; length: number } | undefined;
  return lines.map((line) => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
    if (match?.[1]) {
      const marker = match[1].startsWith("`") ? "`" : "~";
      const rest = match[2] ?? "";
      if (!fence) {
        // Backtick info strings cannot contain a backtick. Treat malformed
        // candidates as ordinary text rather than hiding later headings.
        if (marker !== "`" || !rest.includes("`")) {
          fence = { marker, length: match[1].length };
          return false;
        }
      } else if (marker === fence.marker && match[1].length >= fence.length && rest.trim() === "") {
        fence = undefined;
        return false;
      }
    }
    return !fence;
  });
}

function parsePortableLink(raw: string): KanbanLinkedWorkItemRef | undefined {
  const match = /<!--\s*afx:card\s+({[^\n]*})\s*-->/.exec(raw);
  if (!match?.[1]) return undefined;
  try {
    const metadata = JSON.parse(match[1]) as {
      v?: unknown;
      workItem?: { kind?: unknown; root?: unknown; path?: unknown; wbs?: unknown };
    };
    if (metadata.v !== 1 || !metadata.workItem) return undefined;
    const { kind, root, path, wbs } = metadata.workItem;
    if ((kind !== "spec" && kind !== "task") || typeof root !== "string") return undefined;
    if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("..")) {
      return undefined;
    }
    const source = { rootUri: "", rootName: root, relativePath: path.replace(/\\/g, "/") };
    if (kind === "spec") return { version: 1, kind, source };
    if (typeof wbs !== "string" || !/^\d+(?:\.\d+)+$/.test(wbs)) return undefined;
    return { version: 1, kind, source, wbsId: wbs };
  } catch {
    return undefined;
  }
}

function cleanListCardText(value: string): string {
  return value.replace(/^\s*-\s+/, "").trim();
}

/**
 * Parse only ranges that can be mutated without regenerating unrelated Markdown.
 * Unsupported blocks remain untouched in the source document.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-5] [FR-8] [FR-14] [NFR-3] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] [DES-BOARD-PORTABLE-LINK]
 * @see docs/specs/221-app-workbench-board/tasks.md [3.1] [3.3]
 */
export function parseKanbanMarkdown(content: string): KanbanMarkdownDocument {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = linesWithOffsets(content);
  const headingEligible = markdownHeadingEligibility(lines);
  const headingIndices: number[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (headingEligible[index] && /^##(?!#)\s+\S/.test(lines[index]?.text ?? "")) {
      headingIndices.push(index);
    }
  }

  const columns: KanbanMarkdownColumn[] = [];
  let boardRulesStart: number | undefined;
  const seenIds = new Set<string>();

  for (let headingPosition = 0; headingPosition < headingIndices.length; headingPosition++) {
    const lineIndex = headingIndices[headingPosition];
    if (lineIndex === undefined) continue;
    const line = lines[lineIndex];
    if (!line) continue;
    const title = line.text.replace(/^##\s+/, "").trim();
    const nextLineIndex = headingIndices[headingPosition + 1] ?? lines.length;
    const sectionEnd = lines[nextLineIndex]?.start ?? content.length;
    if (/^board rules$/i.test(title)) {
      boardRulesStart = line.start;
      continue;
    }

    const columnId = `column:${line.start}:${fingerprint(title)}`;
    if (seenIds.has(columnId)) {
      return { content, newline, columns: [], error: `Ambiguous column range for ${title}` };
    }
    seenIds.add(columnId);
    const cards: KanbanMarkdownCard[] = [];

    let cursor = lineIndex + 1;
    while (cursor < nextLineIndex) {
      const cardLine = lines[cursor];
      if (!cardLine) break;
      const listMatch = headingEligible[cursor] ? /^\s*-\s+(.+)$/.exec(cardLine.text) : null;
      const headingMatch = headingEligible[cursor] ? /^###\s+(.+)$/.exec(cardLine.text) : null;
      if (!listMatch && !headingMatch) {
        cursor++;
        continue;
      }

      const kind: KanbanMarkdownCard["kind"] = listMatch ? "list" : "heading";
      const cardStartIndex = cursor;
      let cardEndIndex = cursor + 1;
      if (kind === "list") {
        while (cardEndIndex < nextLineIndex) {
          const following = lines[cardEndIndex]?.text ?? "";
          if (
            /^\s+<!--\s*afx:card\b/.test(following) ||
            /^\s+<!--(?!\s*afx:card\b)/.test(following)
          ) {
            cardEndIndex++;
            continue;
          }
          break;
        }
      } else {
        while (cardEndIndex < nextLineIndex) {
          const following = lines[cardEndIndex]?.text ?? "";
          if (
            headingEligible[cardEndIndex] &&
            (/^##(?!#)\s+\S/.test(following) ||
              /^###\s+\S/.test(following) ||
              /^\s*-\s+\S/.test(following))
          ) {
            break;
          }
          cardEndIndex++;
        }
      }

      const meaningfulEndIndex = trimTrailingBlankStart(lines, cardStartIndex, cardEndIndex);
      const cardEnd = lines[meaningfulEndIndex]?.start ?? sectionEnd;
      const safeEnd = Math.max(cardLine.end, cardEnd);
      const raw = content.slice(cardLine.start, safeEnd);
      const portableMetadataCount = raw.match(/<!--\s*afx:card\b/g)?.length ?? 0;
      if (portableMetadataCount > 1) {
        return {
          content,
          newline,
          columns: [],
          error: `Ambiguous portable metadata for card at offset ${cardLine.start}`,
        };
      }
      let text: string;
      if (kind === "list") {
        text = cleanListCardText(listMatch?.[0] ?? "");
      } else {
        const titleText = headingMatch?.[1]?.trim() ?? "";
        const body = lines
          .slice(cardStartIndex + 1, meaningfulEndIndex)
          .map((item) => item.text)
          .filter((item) => !/^\s*<!--\s*afx:card\b/.test(item))
          .join(newline)
          .trim();
        text = body ? `${titleText}\n${body}` : titleText;
      }
      const cardId = `card:${cardLine.start}:${fingerprint(`${kind}:${text}`)}`;
      if (seenIds.has(cardId)) {
        return { content, newline, columns: [], error: `Ambiguous card range for ${text}` };
      }
      seenIds.add(cardId);
      cards.push({
        id: cardId,
        text,
        start: cardLine.start,
        end: safeEnd,
        kind,
        link: parsePortableLink(raw),
      });
      cursor = Math.max(cursor + 1, cardEndIndex);
    }

    columns.push({
      id: columnId,
      title,
      start: line.start,
      headingEnd: line.contentEnd,
      end: sectionEnd,
      cards,
    });
  }

  return { content, newline, columns, boardRulesStart };
}

function renderPlainCard(text: string, newline: string): string {
  const [first = "", ...rest] = text.trim().split(/\r?\n/);
  return rest.length === 0
    ? `- ${first}${newline}`
    : `### ${first}${newline}${newline}${rest.join(newline)}${newline}`;
}

function markdownLinkTarget(ref: KanbanLinkedWorkItemRef): string {
  const relative = ref.source.relativePath;
  return ref.kind === "task"
    ? `${relative}#${ref.wbsId.replace(/\./g, "")}`
    : relative.replace(/\/spec\.md$/, "/spec.md");
}

function renderLinkedCard(text: string, ref: KanbanLinkedWorkItemRef, newline: string): string {
  const label = text.trim().split(/\r?\n/, 1)[0] || (ref.kind === "task" ? ref.wbsId : "Spec");
  const metadata = {
    v: 1,
    id: `work-${fingerprint(`${ref.kind}:${ref.source.rootUri}:${ref.source.relativePath}:${ref.kind === "task" ? ref.wbsId : ""}`)}`,
    workItem: {
      kind: ref.kind,
      root: ref.source.rootName,
      path: ref.source.relativePath,
      ...(ref.kind === "task" ? { wbs: ref.wbsId } : {}),
    },
  };
  return `- [${label.replace(/[\]\\]/g, "\\$&")}](${markdownLinkTarget(ref)})${newline}  <!-- afx:card ${JSON.stringify(metadata)} -->${newline}`;
}

function insertionAtColumnEnd(
  document: KanbanMarkdownDocument,
  column: KanbanMarkdownColumn,
): number {
  const lines = linesWithOffsets(document.content.slice(column.headingEnd, column.end));
  let offset = column.end;
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (!line) continue;
    if (line.text.trim()) break;
    offset = column.headingEnd + line.start;
  }
  return Math.max(column.headingEnd, offset);
}

function withBoundarySpacing(
  content: string,
  offset: number,
  block: string,
  newline: string,
): string {
  const before = content.slice(0, offset);
  const after = content.slice(offset);
  const prefix =
    before && !before.endsWith(newline + newline)
      ? before.endsWith(newline)
        ? newline
        : newline + newline
      : "";
  const suffix = after && !after.startsWith(newline) ? newline : "";
  return `${before}${prefix}${block.replace(/\s+$/, "")}${newline}${suffix}${after}`;
}

function invalid(message: string): KanbanMutationOutcome {
  return { ok: false, reason: "invalid", message };
}

/**
 * Apply a structured board mutation while preserving every source range that
 * is not the proven mutation target.
 *
 * @see docs/specs/221-app-workbench-board/spec.md [FR-3] [FR-4] [FR-5] [NFR-3] [NFR-5]
 * @see docs/specs/221-app-workbench-board/design.md [DES-BOARD-SERIALIZATION] [DES-API]
 * @see docs/specs/221-app-workbench-board/tasks.md [3.2]
 */
export function mutateKanbanMarkdown(
  document: KanbanMarkdownDocument,
  mutation: KanbanMarkdownMutation,
): KanbanMutationOutcome {
  if (document.error) return { ok: false, reason: "ambiguous", message: document.error };
  const { content, newline } = document;
  const columnById = (id: string) => document.columns.find((column) => column.id === id);
  const cardById = (id: string) =>
    document.columns
      .flatMap((column) => column.cards.map((card) => ({ column, card })))
      .find(({ card }) => card.id === id);

  if (mutation.kind === "addColumn") {
    const title = mutation.title.trim();
    if (!title || /[\r\n]/.test(title)) return invalid("Column title must be one line");
    const offset = document.boardRulesStart ?? content.length;
    return {
      ok: true,
      content: withBoundarySpacing(content, offset, `## ${title}${newline}`, newline),
    };
  }

  if (mutation.kind === "renameColumn") {
    const column = columnById(mutation.columnId);
    const title = mutation.title.trim();
    if (!column) return { ok: false, reason: "missing", message: "Column no longer exists" };
    if (!title || /[\r\n]/.test(title)) return invalid("Column title must be one line");
    return {
      ok: true,
      content: `${content.slice(0, column.start)}## ${title}${content.slice(column.headingEnd)}`,
    };
  }

  if (mutation.kind === "deleteColumn") {
    const column = columnById(mutation.columnId);
    if (!column) return { ok: false, reason: "missing", message: "Column no longer exists" };
    if (column.cards.length) return invalid("Move or delete cards before deleting the column");
    return { ok: true, content: `${content.slice(0, column.start)}${content.slice(column.end)}` };
  }

  if (mutation.kind === "addCard") {
    const column = columnById(mutation.columnId);
    const text = mutation.text.trim();
    if (!column) return { ok: false, reason: "missing", message: "Target column no longer exists" };
    if (!text) return invalid("Card text is required");
    const beforeCard = mutation.beforeCardId
      ? column.cards.find((card) => card.id === mutation.beforeCardId)
      : undefined;
    if (mutation.beforeCardId && !beforeCard) {
      return { ok: false, reason: "missing", message: "Target card no longer exists" };
    }
    const offset = beforeCard?.start ?? insertionAtColumnEnd(document, column);
    const block = mutation.link
      ? renderLinkedCard(text, mutation.link, newline)
      : renderPlainCard(text, newline);
    return { ok: true, content: withBoundarySpacing(content, offset, block, newline) };
  }

  if (mutation.kind === "editCard") {
    const found = cardById(mutation.cardId);
    const text = mutation.text.trim();
    if (!found) return { ok: false, reason: "missing", message: "Card no longer exists" };
    if (!text) return invalid("Card text is required");
    const raw = content.slice(found.card.start, found.card.end);
    const metadata = raw.match(/\s*<!--\s*afx:card\s+[^\n]*-->\s*/)?.[0] ?? "";
    const rendered = `${renderPlainCard(text, newline).trimEnd()}${metadata ? `${newline}${metadata.trim()}${newline}` : newline}`;
    return {
      ok: true,
      content: `${content.slice(0, found.card.start)}${rendered}${content.slice(found.card.end)}`,
    };
  }

  if (mutation.kind === "deleteCard") {
    const found = cardById(mutation.cardId);
    if (!found) return { ok: false, reason: "missing", message: "Card no longer exists" };
    return {
      ok: true,
      content: `${content.slice(0, found.card.start)}${content.slice(found.card.end)}`,
    };
  }

  if (mutation.kind === "moveCard") {
    const found = cardById(mutation.cardId);
    const targetColumn = columnById(mutation.toColumnId);
    if (!found || !targetColumn) {
      return { ok: false, reason: "missing", message: "Card or target column no longer exists" };
    }
    if (mutation.beforeCardId === mutation.cardId) return { ok: true, content };
    const beforeCard = mutation.beforeCardId
      ? targetColumn.cards.find((card) => card.id === mutation.beforeCardId)
      : undefined;
    if (mutation.beforeCardId && !beforeCard) {
      return { ok: false, reason: "missing", message: "Target card no longer exists" };
    }
    const block = content.slice(found.card.start, found.card.end).trim();
    const without = `${content.slice(0, found.card.start)}${content.slice(found.card.end)}`;
    const originalOffset = beforeCard?.start ?? insertionAtColumnEnd(document, targetColumn);
    const offset =
      originalOffset > found.card.start
        ? originalOffset - (found.card.end - found.card.start)
        : originalOffset;
    return { ok: true, content: withBoundarySpacing(without, offset, block, newline) };
  }

  const column = columnById(mutation.columnId);
  if (!column) return { ok: false, reason: "missing", message: "Column no longer exists" };
  if (mutation.beforeColumnId === mutation.columnId) return { ok: true, content };
  const beforeColumn = mutation.beforeColumnId ? columnById(mutation.beforeColumnId) : undefined;
  if (mutation.beforeColumnId && !beforeColumn) {
    return { ok: false, reason: "missing", message: "Target column no longer exists" };
  }
  const block = content.slice(column.start, column.end).trim();
  const without = `${content.slice(0, column.start)}${content.slice(column.end)}`;
  const originalOffset = beforeColumn?.start ?? document.boardRulesStart ?? content.length;
  const offset =
    originalOffset > column.start ? originalOffset - (column.end - column.start) : originalOffset;
  return { ok: true, content: withBoundarySpacing(without, offset, block, newline) };
}

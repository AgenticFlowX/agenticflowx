/**
 * Surgical frontmatter list editor: add or remove a single entry in a named
 * list key while preserving key order, indentation, quoting, comments, and all
 * unrelated content. Never a YAML load→dump round-trip (which would reflow the
 * whole document and destroy diffs on governed SDD files).
 *
 * @see docs/specs/230-app-workbench-spec-authoring/spec.md [FR-8] [FR-9]
 * @see docs/specs/230-app-workbench-spec-authoring/design.md [DES-API]
 */

export interface FrontmatterListEdit {
  content: string;
  changed: boolean;
  /** Distinguishes an idempotent no-op from syntax the surgical editor refuses. */
  outcome: "changed" | "unchanged" | "unsupported";
}

/**
 * Add or remove `entry` in the frontmatter list under `key`.
 *
 * - `add`: idempotent — a no-op success if the entry already exists. Otherwise
 *   appends, matching the list's existing flow (`[a, b]`) or block (`- a`)
 *   style; if the key is absent it is created in block style just before the
 *   frontmatter close.
 * - `remove`: drops the matching entry; if the list becomes empty the whole key
 *   is removed.
 *
 * A document without a well-formed opening frontmatter block, or an existing
 * `key` whose value is not a list, yields `changed: false` (no write) rather
 * than a partial or corrupting edit.
 */
export function editFrontmatterList(
  raw: string,
  key: string,
  entry: string,
  op: "add" | "remove",
): FrontmatterListEdit {
  const lines = sourceLines(raw);
  const block = locateFrontmatter(lines);
  if (!block) return unsupported(raw);

  const found = findKey(raw, lines, block, key);
  if (!found) {
    return op === "add" ? insertNewKey(raw, lines, block, key, entry) : unchanged(raw);
  }
  if (found.kind === "scalar" || found.kind === "empty") return unsupported(raw);
  if (found.kind === "flow") {
    return op === "add" ? addToFlow(raw, found, entry) : removeFromFlow(raw, lines, found, entry);
  }
  if (found.kind !== "block") return unsupported(raw);
  return op === "add"
    ? addToBlock(raw, lines, found, entry)
    : removeFromBlock(raw, lines, found, entry);
}

interface FrontmatterBlock {
  openLine: number;
  closeLine: number;
}

interface SourceLine {
  start: number;
  end: number;
  content: string;
  eol: string;
}

function sourceLines(raw: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const content = match[1] ?? "";
    const eol = match[2] ?? "";
    const start = match.index;
    const end = start + content.length + eol.length;
    if (start === raw.length && content === "" && eol === "") break;
    lines.push({ start, end, content, eol });
    if (eol === "") break;
  }
  return lines;
}

function locateFrontmatter(lines: readonly SourceLine[]): FrontmatterBlock | undefined {
  if ((lines[0]?.content ?? "").replace(/^\uFEFF/, "").trim() !== "---") return undefined;
  const closeLine = lines.findIndex((line, index) => index > 0 && line.content.trim() === "---");
  if (closeLine === -1) return undefined;
  return { openLine: 0, closeLine };
}

interface FlowKey {
  kind: "flow";
  keyLine: number;
  open: number;
  close: number;
}

interface BlockItem {
  line: number;
  indent: string;
  value: string;
}

interface BlockKey {
  kind: "block";
  keyLine: number;
  items: BlockItem[];
}

interface NonListKey {
  kind: "empty" | "scalar";
  keyLine: number;
}

type FoundKey = FlowKey | BlockKey | NonListKey;

function findKey(
  raw: string,
  lines: readonly SourceLine[],
  block: FrontmatterBlock,
  key: string,
): FoundKey | undefined {
  const keyRe = new RegExp(`^${escapeRe(key)}[\\t ]*:(.*)$`);
  for (let lineIndex = block.openLine + 1; lineIndex < block.closeLine; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    const match = keyRe.exec(line.content);
    if (!match) continue;
    const colon = line.content.indexOf(":");
    const valueStart = line.start + colon + 1;
    const rest = raw.slice(valueStart, line.start + line.content.length);
    const sameLineOpen = firstNonWhitespaceOffset(rest);
    if (sameLineOpen !== undefined && rest[sameLineOpen] === "[") {
      const open = valueStart + sameLineOpen;
      const close = matchingFlowClose(raw, open, lines[block.closeLine]?.start ?? raw.length);
      return close === undefined
        ? { kind: "scalar", keyLine: lineIndex }
        : { kind: "flow", keyLine: lineIndex, open, close };
    }
    if (rest.trim() !== "") return { kind: "scalar", keyLine: lineIndex };

    const nextContentLine = nextNonBlankLine(lines, lineIndex + 1, block.closeLine);
    if (nextContentLine !== undefined) {
      const candidate = lines[nextContentLine];
      const trimmed = candidate?.content.trimStart() ?? "";
      if ((candidate?.content.length ?? 0) > trimmed.length && trimmed.startsWith("[")) {
        const open = (candidate?.start ?? 0) + (candidate?.content.indexOf("[") ?? 0);
        const close = matchingFlowClose(raw, open, lines[block.closeLine]?.start ?? raw.length);
        return close === undefined
          ? { kind: "scalar", keyLine: lineIndex }
          : { kind: "flow", keyLine: lineIndex, open, close };
      }
    }

    const items: BlockItem[] = [];
    for (let itemLine = lineIndex + 1; itemLine < block.closeLine; itemLine++) {
      const candidate = lines[itemLine];
      if (!candidate) break;
      if (candidate.content.trim() === "" || candidate.content.trimStart().startsWith("#")) {
        continue;
      }
      const item = /^([ \t]+)-[ \t]+(.*)$/.exec(candidate.content);
      if (!item) break;
      items.push({
        line: itemLine,
        indent: item[1] ?? "  ",
        value: scalarValue(item[2] ?? ""),
      });
    }
    return items.length > 0
      ? { kind: "block", keyLine: lineIndex, items }
      : { kind: "empty", keyLine: lineIndex };
  }
  return undefined;
}

function insertNewKey(
  raw: string,
  lines: readonly SourceLine[],
  block: FrontmatterBlock,
  key: string,
  entry: string,
): FrontmatterListEdit {
  const close = lines[block.closeLine];
  if (!close) return unsupported(raw);
  const previous = lines[block.closeLine - 1];
  const eol = previous?.eol || close.eol || "\n";
  return changed(
    splice(raw, close.start, close.start, `${key}: [${quoteYamlString(entry)}]${eol}`),
  );
}

function addToFlow(raw: string, found: FlowKey, entry: string): FrontmatterListEdit {
  const inner = raw.slice(found.open + 1, found.close);
  const items = flowItems(inner);
  if (items.some((item) => item.value === entry)) return unchanged(raw);
  const rendered = quoteYamlString(entry);
  if (items.length === 0) {
    if (!hasLineBreak(inner)) {
      return changed(splice(raw, found.open + 1, found.close, rendered));
    }
    const trailing = trailingWhitespace(inner);
    const eol = lastLineBreak(trailing || inner) ?? "\n";
    const closeIndent = indentationAt(raw, found.close);
    return changed(
      splice(raw, found.open + 1, found.close, `${eol}${closeIndent}  ${rendered}${trailing}`),
    );
  }

  const trailing = trailingWhitespace(inner);
  const core = inner.slice(0, inner.length - trailing.length);
  if (!hasLineBreak(inner)) {
    return changed(splice(raw, found.open + 1, found.close, `${core}, ${rendered}${trailing}`));
  }

  const last = items.at(-1);
  if (!last) return unsupported(raw);
  const eol = lastLineBreak(trailing || inner) ?? "\n";
  const indent = indentationAt(inner, last.valueStart);
  const commaBefore = last.separatorAfter === undefined ? "," : "";
  const commaAfter = last.separatorAfter === undefined ? "" : ",";
  return changed(
    splice(
      raw,
      found.open + 1,
      found.close,
      `${core}${commaBefore}${eol}${indent}${rendered}${commaAfter}${trailing}`,
    ),
  );
}

function removeFromFlow(
  raw: string,
  lines: readonly SourceLine[],
  found: FlowKey,
  entry: string,
): FrontmatterListEdit {
  const inner = raw.slice(found.open + 1, found.close);
  const items = flowItems(inner);
  const index = items.findIndex((item) => removeMatches(item.value, entry));
  if (index < 0) return unchanged(raw);
  if (items.length === 1) return removeKeySpan(raw, lines, found.keyLine, found.close);

  const item = items[index];
  if (!item) return unchanged(raw);
  let start: number;
  let end: number;
  if (item.separatorAfter !== undefined) {
    start = item.segmentStart;
    end = item.separatorAfter + 1;
  } else {
    const previous = items[index - 1];
    if (previous?.separatorAfter === undefined) return unchanged(raw);
    start = previous.separatorAfter;
    end = item.valueEnd;
  }
  let nextInner = splice(inner, start, end, "");
  if (index === 0 && !hasLineBreak(inner.slice(0, items[1]?.valueStart ?? 0))) {
    nextInner = nextInner.replace(/^[ \t]+/, "");
  }
  return changed(splice(raw, found.open + 1, found.close, nextInner));
}

function addToBlock(
  raw: string,
  lines: readonly SourceLine[],
  found: BlockKey,
  entry: string,
): FrontmatterListEdit {
  if (found.items.some((item) => item.value === entry)) return unchanged(raw);
  const last = found.items.at(-1);
  const line = last ? lines[last.line] : undefined;
  if (!last || !line) return unsupported(raw);
  const eol = line.eol || "\n";
  return changed(
    splice(raw, line.end, line.end, `${last.indent}- ${quoteYamlString(entry)}${eol}`),
  );
}

function removeFromBlock(
  raw: string,
  lines: readonly SourceLine[],
  found: BlockKey,
  entry: string,
): FrontmatterListEdit {
  const item = found.items.find((candidate) => removeMatches(candidate.value, entry));
  if (!item) return unchanged(raw);
  const line = lines[item.line];
  if (!line) return unchanged(raw);
  if (found.items.length === 1) {
    const keyLine = lines[found.keyLine];
    if (!keyLine) return unchanged(raw);
    return changed(splice(raw, keyLine.start, line.end, ""));
  }
  return changed(splice(raw, line.start, line.end, ""));
}

interface FlowItem {
  segmentStart: number;
  valueStart: number;
  valueEnd: number;
  value: string;
  separatorAfter?: number;
}

function flowItems(inner: string): FlowItem[] {
  const separators: number[] = [];
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let comment = false;
  let depth = 0;
  for (let index = 0; index < inner.length; index++) {
    const character = inner[index];
    if (comment) {
      if (character === "\n" || character === "\r") comment = false;
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (quote === "'") {
      if (character === "'" && inner[index + 1] === "'") index += 1;
      else if (character === "'") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "#") {
      comment = true;
      continue;
    }
    if (character === "[" || character === "{" || character === "(") depth += 1;
    else if (character === "]" || character === "}" || character === ")") depth -= 1;
    else if (character === "," && depth === 0) separators.push(index);
  }

  const items: FlowItem[] = [];
  let segmentStart = 0;
  for (let itemIndex = 0; itemIndex <= separators.length; itemIndex++) {
    const separatorAfter = separators[itemIndex];
    const segmentEnd = separatorAfter ?? inner.length;
    const segment = inner.slice(segmentStart, segmentEnd);
    const bounds = scalarBounds(segment);
    if (bounds) {
      items.push({
        segmentStart,
        valueStart: segmentStart + bounds.start,
        valueEnd: segmentStart + bounds.end,
        value: scalarValue(segment.slice(bounds.start, bounds.end)),
        ...(separatorAfter === undefined ? {} : { separatorAfter }),
      });
    }
    segmentStart = segmentEnd + 1;
  }
  return items;
}

function scalarBounds(segment: string): { start: number; end: number } | undefined {
  let start = 0;
  while (start < segment.length && /\s/.test(segment[start] ?? "")) start += 1;
  if (start >= segment.length) return undefined;
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let commentStart = -1;
  for (let index = start; index < segment.length; index++) {
    const character = segment[index];
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (quote === "'") {
      if (character === "'" && segment[index + 1] === "'") index += 1;
      else if (character === "'") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "#") {
      commentStart = index;
      break;
    }
  }
  let end = commentStart >= 0 ? commentStart : segment.length;
  while (end > start && /\s/.test(segment[end - 1] ?? "")) end -= 1;
  return end > start ? { start, end } : undefined;
}

function removeMatches(item: string, entry: string): boolean {
  const value = scalarValue(item);
  if (value === entry) return true;
  if (value.includes("://")) {
    const colon = value.lastIndexOf(":");
    if (colon >= 0 && value.slice(colon + 1) === entry) return true;
  }
  return normalizedReference(value) === normalizedReference(entry);
}

function scalarValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'"))
    return trimmed.slice(1, -1).replace(/''/g, "'");
  return trimmed;
}

function quoteYamlString(entry: string): string {
  return JSON.stringify(entry);
}

function normalizedReference(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\.(?:md|markdown)$/i, "");
}

function removeKeySpan(
  raw: string,
  lines: readonly SourceLine[],
  keyLine: number,
  close: number,
): FrontmatterListEdit {
  const start = lines[keyLine]?.start;
  const closeLine = lines.find((line) => close >= line.start && close < line.end);
  if (start === undefined || !closeLine) return unchanged(raw);
  return changed(splice(raw, start, closeLine.end, ""));
}

function matchingFlowClose(raw: string, open: number, limit: number): number | undefined {
  let quote: "'" | '"' | undefined;
  let escaped = false;
  let comment = false;
  let depth = 0;
  for (let index = open; index < limit; index++) {
    const character = raw[index];
    if (comment) {
      if (character === "\n" || character === "\r") comment = false;
      continue;
    }
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (quote === "'") {
      if (character === "'" && raw[index + 1] === "'") index += 1;
      else if (character === "'") quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === "#") comment = true;
    else if (character === "[") depth += 1;
    else if (character === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

function firstNonWhitespaceOffset(value: string): number | undefined {
  const offset = value.search(/\S/);
  return offset < 0 ? undefined : offset;
}

function nextNonBlankLine(
  lines: readonly SourceLine[],
  start: number,
  end: number,
): number | undefined {
  for (let index = start; index < end; index++) {
    const content = lines[index]?.content ?? "";
    if (content.trim() !== "" && !content.trimStart().startsWith("#")) return index;
  }
  return undefined;
}

function trailingWhitespace(value: string): string {
  return /\s*$/.exec(value)?.[0] ?? "";
}

function hasLineBreak(value: string): boolean {
  return value.includes("\n") || value.includes("\r");
}

function lastLineBreak(value: string): string | undefined {
  return [...value.matchAll(/\r\n|\n|\r/g)].at(-1)?.[0];
}

function indentationAt(value: string, offset: number): string {
  const lineStart = Math.max(
    value.lastIndexOf("\n", offset - 1),
    value.lastIndexOf("\r", offset - 1),
  );
  return /^[ \t]*/.exec(value.slice(lineStart + 1, offset))?.[0] ?? "";
}

function splice(value: string, start: number, end: number, replacement: string): string {
  return `${value.slice(0, start)}${replacement}${value.slice(end)}`;
}

function changed(content: string): FrontmatterListEdit {
  return { content, changed: true, outcome: "changed" };
}

function unchanged(content: string): FrontmatterListEdit {
  return { content, changed: false, outcome: "unchanged" };
}

function unsupported(content: string): FrontmatterListEdit {
  return { content, changed: false, outcome: "unsupported" };
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

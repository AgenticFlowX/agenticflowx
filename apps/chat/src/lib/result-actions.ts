/**
 * Result-action parsing for AFX assistant output.
 *
 * Extracts actionable `/afx-*` follow-up commands from explicit `Next:` /
 * `Next (ranked):` sections used by bundled AFX skills.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import { type AfxCommandGroup, classifyAfxCommand } from "./command-catalog";

export type ResultActionStatus = "supported" | "draft-only-alias" | "unknown";

export type ParsedResultAction = Readonly<{
  command: string;
  family: string | null;
  subcommand: string | null;
  label: string;
  group: AfxCommandGroup | "unknown";
  autoSend: boolean;
  status: ResultActionStatus;
}>;

const CODE_COMMAND_RE = /`(\/afx-[^`\n]+)`/gi;
const BARE_COMMAND_RE = /\/afx-[a-z]+(?:(?!\s+\/afx-[a-z]+)[^\n`])*/gi;
const NEXT_LABEL_RE =
  /^\s*(?:[-*]\s*)?(?:>\s*)?(?:\*\*|__)?next(?:\s*\([^)]*\))?\s*:\s*(?:\*\*|__)?\s*/i;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+[.)])\s+/;
const SEPARATOR_LINE_RE = /^\s*[-–—─]{2,}\s*$/;
const TRAILING_PROSE_RE = /\s+(?:[-–—]\s+|#\s+)/;
const SENTENCE_TRAILING_RE = /[.,;:!?]+$/;
const MAX_RESULT_ACTIONS = 3;
const LEGACY_UI_ACTION_MARKER_PARTS = ["AFX", "UI", "ACTIONS"] as const;
const LEGACY_UI_ACTION_MARKER = LEGACY_UI_ACTION_MARKER_PARTS.join("-");

/**
 * Removes obsolete machine-action marker blocks from persisted or freshly
 * streamed assistant prose without re-enabling that legacy action protocol.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-16]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function stripLegacyUiActionBlocks(output: string): string {
  const lines = output.split(/\r?\n/);
  const kept: string[] = [];
  let inLegacyBlock = false;

  for (const line of lines) {
    if (isLegacyUiActionBoundary(line, "START")) {
      inLegacyBlock = true;
      continue;
    }

    if (inLegacyBlock) {
      if (isLegacyUiActionBoundary(line, "END")) inLegacyBlock = false;
      continue;
    }

    if (isLegacyUiActionBoundary(line, "END")) continue;
    kept.push(line);
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseResultActions(output: string): ParsedResultAction[] {
  const candidates: string[] = [];
  const lines = output.split(/\r?\n/);
  let inNextSection = false;
  let allowLeadingBlank = false;

  for (const rawLine of lines) {
    const nextMatch = rawLine.match(NEXT_LABEL_RE);
    if (nextMatch) {
      const inlineText = rawLine.slice(nextMatch[0].length);
      inNextSection = true;
      allowLeadingBlank = inlineText.trim() === "";
      collectCommands(inlineText, candidates);
      continue;
    }

    if (!inNextSection) {
      continue;
    }

    if (rawLine.trim() === "") {
      if (allowLeadingBlank) continue;
      inNextSection = false;
      continue;
    }

    if (isSeparatorLine(rawLine)) {
      inNextSection = false;
      continue;
    }

    allowLeadingBlank = false;

    if (LIST_ITEM_RE.test(rawLine)) {
      collectCommands(rawLine.replace(LIST_ITEM_RE, ""), candidates);
      continue;
    }

    if (hasAfxCommand(rawLine)) {
      collectCommands(rawLine, candidates);
      continue;
    }

    inNextSection = false;
  }

  const seen = new Set<string>();
  const actions: ParsedResultAction[] = [];

  for (const candidate of candidates) {
    const command = normalizeCommand(candidate);
    if (!command) continue;

    const dedupeKey = command.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    actions.push(toResultAction(command));
    if (actions.length >= MAX_RESULT_ACTIONS) break;
  }

  return actions;
}

export function stripResultActionSections(output: string): string {
  const lines = output.split(/\r?\n/);
  const kept: string[] = [];

  for (let index = 0; index < lines.length; ) {
    if (NEXT_LABEL_RE.test(lines[index] ?? "")) {
      index = findNextSectionEnd(lines, index);
      continue;
    }

    kept.push(lines[index] ?? "");
    index += 1;
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findNextSectionEnd(lines: readonly string[], startIndex: number): number {
  const nextMatch = lines[startIndex]?.match(NEXT_LABEL_RE);
  const inlineText = nextMatch ? lines[startIndex]?.slice(nextMatch[0].length) : "";
  let allowLeadingBlank = inlineText.trim() === "";
  let afterSeparator = false;
  let index = startIndex + 1;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      if (allowLeadingBlank) {
        index += 1;
        continue;
      }
      return index + 1;
    }

    if (isSeparatorLine(rawLine)) {
      afterSeparator = true;
      allowLeadingBlank = false;
      index += 1;
      continue;
    }

    if (afterSeparator || LIST_ITEM_RE.test(rawLine) || hasAfxCommand(rawLine)) {
      allowLeadingBlank = false;
      index += 1;
      continue;
    }

    return index;
  }

  return index;
}

function isSeparatorLine(line: string): boolean {
  return SEPARATOR_LINE_RE.test(line);
}

function isLegacyUiActionBoundary(line: string, boundary: "START" | "END"): boolean {
  const trimmed = line.trim();
  const marker = `${LEGACY_UI_ACTION_MARKER}:${boundary}`;
  return trimmed === marker || trimmed === `<!-- ${marker} -->` || trimmed === `<!--${marker}-->`;
}

function collectCommands(text: string, commands: string[]): void {
  CODE_COMMAND_RE.lastIndex = 0;
  for (const match of text.matchAll(CODE_COMMAND_RE)) {
    if (match[1]) commands.push(match[1]);
  }

  BARE_COMMAND_RE.lastIndex = 0;
  for (const match of text.matchAll(BARE_COMMAND_RE)) {
    if (match[0]) commands.push(match[0]);
  }
}

function hasAfxCommand(text: string): boolean {
  CODE_COMMAND_RE.lastIndex = 0;
  BARE_COMMAND_RE.lastIndex = 0;
  return CODE_COMMAND_RE.test(text) || BARE_COMMAND_RE.test(text);
}

function normalizeCommand(command: string): string | null {
  const trimmed = command.trim().replace(/^`+|`+$/g, "");
  const proseSplit = trimmed.split(TRAILING_PROSE_RE)[0]?.trim() ?? "";
  const withoutMarkdown = proseSplit.replace(/\s+\*\*?$/g, "").replace(SENTENCE_TRAILING_RE, "");
  const normalized = withoutMarkdown
    .replace(/\s--\s+([a-z][\w-]*)\b/gi, " --$1")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.startsWith("/afx-") ? normalized : null;
}

function toResultAction(command: string): ParsedResultAction {
  const classification = classifyAfxCommand(command);

  switch (classification.kind) {
    case "supported":
      return {
        command,
        family: classification.entry.family,
        subcommand: classification.entry.subcommand,
        label: classification.entry.label,
        group: classification.entry.group,
        autoSend: classification.autoSend,
        status: "supported",
      };
    case "draft-only-alias":
      return {
        command,
        family: classification.entry.family,
        subcommand: classification.entry.subcommand,
        label: classification.entry.label,
        group: "unknown",
        autoSend: false,
        status: "draft-only-alias",
      };
    case "unknown":
      return {
        command,
        family: classification.family,
        subcommand: classification.subcommand,
        label: labelFromCommand(command),
        group: "unknown",
        autoSend: false,
        status: "unknown",
      };
  }
}

function labelFromCommand(command: string): string {
  const parts = command.match(/^\/afx-[a-z]+\s+([a-z][a-z-]*)/i);
  const subcommand = parts?.[1] ?? command.match(/^\/(afx-[a-z]+)/i)?.[1] ?? "Draft";
  return subcommand
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

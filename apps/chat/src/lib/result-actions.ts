/**
 * Result-action parsing for AFX assistant output.
 *
 * Extracts actionable `/afx-*` follow-up commands from the output formats used
 * by bundled AFX skills: inline `Next:`, `Next (ranked):` sections, numbered
 * lists, and backtick-wrapped commands.
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
const BARE_COMMAND_RE = /\/afx-[a-z]+(?:[^\n`]*)/gi;
const NEXT_LABEL_RE = /^\s*(?:[-*]\s*)?(?:>\s*)?next(?:\s*\([^)]*\))?\s*:\s*/i;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+[.)])\s+/;
const TRAILING_PROSE_RE = /\s+(?:[-–—]\s+|#\s+)/;
const SENTENCE_TRAILING_RE = /[.,;:!?]+$/;

export function parseResultActions(output: string): ParsedResultAction[] {
  const candidates: string[] = [];
  const lines = output.split(/\r?\n/);
  let inNextList = false;

  for (const rawLine of lines) {
    const nextMatch = rawLine.match(NEXT_LABEL_RE);
    if (nextMatch) {
      inNextList = true;
      collectCommands(rawLine.slice(nextMatch[0].length), candidates);
      continue;
    }

    if (inNextList && LIST_ITEM_RE.test(rawLine)) {
      collectCommands(rawLine.replace(LIST_ITEM_RE, ""), candidates);
      continue;
    }

    if (inNextList && rawLine.trim() === "") {
      inNextList = false;
      continue;
    }

    collectCommands(rawLine, candidates);
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
  }

  return actions;
}

function collectCommands(text: string, commands: string[]): void {
  for (const match of text.matchAll(CODE_COMMAND_RE)) {
    if (match[1]) commands.push(match[1]);
  }

  for (const match of text.matchAll(BARE_COMMAND_RE)) {
    if (match[0]) commands.push(match[0]);
  }
}

function normalizeCommand(command: string): string | null {
  const trimmed = command.trim().replace(/^`+|`+$/g, "");
  const proseSplit = trimmed.split(TRAILING_PROSE_RE)[0]?.trim() ?? "";
  const withoutMarkdown = proseSplit.replace(/\s+\*\*?$/g, "").replace(SENTENCE_TRAILING_RE, "");
  const normalized = withoutMarkdown.replace(/\s+/g, " ").trim();
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

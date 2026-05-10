/** Parser and normalizer for additive AFX assistant UI action blocks. */

export type AfxUiActionMode = "run" | "insert";

export type AfxUiAction = Readonly<{
  rank: number;
  label: string;
  command: string;
  mode: AfxUiActionMode;
  reason?: string;
  vocabulary?: string;
}>;

const ACTION_BLOCK_RE =
  /<!--\s*AFX-UI-ACTIONS:START\s*-->([\s\S]*?)<!--\s*AFX-UI-ACTIONS:END\s*-->/gi;
const JSON_FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;
const CONTROL_OR_SHELL_RE = /[\r\n`]|(?:^|\s)(?:&&|\|\||;|\$\(|<|>)(?:\s|$)/;
const MAX_ACTIONS = 3;
const MAX_LABEL_LENGTH = 80;
const MAX_REASON_LENGTH = 160;
const MAX_VOCABULARY_LENGTH = 180;

export function parseAfxUiActions(content: string): AfxUiAction[] {
  const normalized: AfxUiAction[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(ACTION_BLOCK_RE)) {
    const json = extractJsonPayload(match[1] ?? "");
    if (!json) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      continue;
    }

    for (const action of normalizeAfxUiActions(parsed)) {
      const key = action.command.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(action);
      if (normalized.length >= MAX_ACTIONS) return normalized;
    }
  }

  return normalized;
}

export function normalizeAfxUiActions(value: unknown): AfxUiAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeAfxUiAction(item))
    .filter((item): item is AfxUiAction => item !== null)
    .sort((left, right) => left.rank - right.rank);
}

export function stripAfxUiActionBlocks(content: string): string {
  return content
    .replace(ACTION_BLOCK_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAfxUiAction(value: unknown): AfxUiAction | null {
  if (!isRecord(value)) return null;

  const rank = normalizeRank(value.rank);
  const label = normalizeText(value.label, MAX_LABEL_LENGTH);
  const command = normalizeCommand(value.command);
  const mode = value.mode === "run" || value.mode === "insert" ? value.mode : null;

  if (rank === null || !label || !command || !mode) return null;

  const reason = normalizeText(value.reason, MAX_REASON_LENGTH);
  const vocabulary = normalizeText(value.vocabulary, MAX_VOCABULARY_LENGTH);

  return Object.freeze({
    rank,
    label,
    command,
    mode,
    ...(reason ? { reason } : {}),
    ...(vocabulary ? { vocabulary } : {}),
  });
}

function extractJsonPayload(block: string): string | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(JSON_FENCE_RE)?.[1]?.trim();
  return fenced || trimmed;
}

function normalizeRank(value: unknown): number | null {
  const rank = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(rank) || rank < 1) return null;
  return rank;
}

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeCommand(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const command = value.replace(/\s+/g, " ").trim();
  if (!/^\/afx-[a-z]+(?:\s|$)/i.test(command)) return null;
  if (CONTROL_OR_SHELL_RE.test(command)) return null;
  if (/^(?:https?:|file:|!)/i.test(command)) return null;
  return command;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

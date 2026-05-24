/**
 * Normalizes loose Pi RPC tool argument payloads into the shared AgentEvent shape.
 *
 * @see docs/specs/351-agent-pi/spec.md [FR-1] [FR-4]
 * @see docs/specs/351-agent-pi/design.md [DES-PI-RPC-FLOW] [DES-API]
 */

const SHELL_TOOL_PATTERN = /(^|[_\s-])(bash|zsh|sh|shell|powershell|pwsh|terminal)($|[_\s-])/i;

export function normalizePiToolArgs(
  raw: Record<string, unknown>,
  toolName: string,
): Record<string, unknown> | undefined {
  const value =
    raw["args"] ??
    raw["arguments"] ??
    raw["parameters"] ??
    raw["params"] ??
    raw["input"] ??
    raw["command"];

  if (typeof value === "undefined") return undefined;
  if (isRecord(value)) return value;
  if (Array.isArray(value)) return { command: value };
  if (typeof value === "string") {
    return isShellToolName(toolName) ? { command: value } : { input: value };
  }
  return { input: value };
}

function isShellToolName(toolName: string): boolean {
  return SHELL_TOOL_PATTERN.test(toolName);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

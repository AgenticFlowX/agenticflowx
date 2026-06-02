/**
 * Pure Explore-mode runtime guardrail classifier for host-side tool and shell decisions.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW] [DES-PANELS-EXPLORE-PROMPT]
 */
import {
  type ShellInvocation,
  classifyReadOnlyShellInvocation,
} from "../utils/read-only-command-classifier";

export type ExploreGuardrailStatus = "allow" | "block" | "pending";

export interface ExploreGuardrailDecision {
  status: ExploreGuardrailStatus;
  normalizedToolName: string;
  reason: string;
  detail?: string;
}

const EXPLORE_BLOCKED_TOOL_PATTERNS = [
  /(^|_)(apply_)?patch($|_)/,
  /(^|_)(write|edit|replace|insert|append|save|create|delete|remove|rename|move|mkdir|touch|chmod|chown|upload|download|submit|click|type|fill)($|_)/,
  /(^|_)(run|command|shell|bash|zsh|sh|powershell|pwsh|exec|execute|terminal|spawn|process)($|_)/,
  /(^|_)(git|npm|pnpm|yarn|bun|install|build|test|lint|format|docker|deploy|migrate|sql|database|db)($|_)/,
] as const;

const EXPLORE_SHELL_TOOL_PATTERN = /(^|_)(bash|zsh|sh|shell|powershell|pwsh|terminal)($|_)/;
const EXPLORE_SHELL_COMMAND_ARG_KEYS = [
  "command",
  "cmd",
  "script",
  "input",
  "code",
  "commandLine",
  "command_line",
] as const;
const EXPLORE_NESTED_ARG_KEYS = ["arguments", "parameters", "params", "input"] as const;

const EXPLORE_MCP_TOOL_NAMES = new Set(["mcp_tool", "use_mcp_tool"]);

const EXPLORE_READ_ONLY_TOOL_NAMES = new Set([
  "access_mcp_resource",
  "browser_fetch",
  "browser_find",
  "browser_get_text",
  "browser_extract_text",
  "browser_navigate",
  "browser_open",
  "browser_read",
  "browser_search",
  "browser_screenshot",
  "browser_snapshot",
  "codebase_search",
  "codesearch",
  "fetch_url",
  "finance",
  "find",
  "git_diff",
  "git_log",
  "git_show",
  "git_status",
  "glob",
  "grep",
  "image_query",
  "image_search",
  "list",
  "list_code_definition_names",
  "list_files",
  "lsp",
  "open_url",
  "page_fetch",
  "page_read",
  "read",
  "read_command_output",
  "read_file",
  "read_url",
  "screenshot",
  "search_files",
  "search_query",
  "sports",
  "time",
  "todoread",
  "view",
  "webfetch",
  "web_fetch",
  "web_get",
  "web_extract",
  "web_open",
  "web_read",
  "web_run",
  "web_search",
  "websearch",
  "weather",
]);

const EXPLORE_BROWSER_NAVIGATION_ACTIONS = new Set(["launch", "navigate", "open"]);
const EXPLORE_BROWSER_INSPECTION_ACTIONS = new Set([
  "close",
  "extract_text",
  "get_text",
  "read",
  "screenshot",
  "scroll_down",
  "scroll_up",
  "snapshot",
]);
const EXPLORE_BROWSER_MUTATING_ACTIONS = new Set([
  "check",
  "click",
  "delete",
  "download",
  "drag",
  "drop",
  "edit",
  "fill",
  "press",
  "remove",
  "save",
  "select",
  "select_option",
  "submit",
  "type",
  "uncheck",
  "upload",
  "write",
]);

const EXPLORE_READ_ONLY_WEB_REQUEST_TOOL_NAMES = new Set([
  "fetch",
  "get_page",
  "get_url",
  "get_web",
  "get_website",
  "http_fetch",
  "http_get",
  "https_get",
  "request_get",
]);

const EXPLORE_READ_ONLY_TOOL_PATTERNS = [
  /(^|_)(read|view)($|_)/,
  /(^|_)(inspect|peek|preview|screenshot|snapshot)($|_)/,
  /(^|_)open_(file|document|text|url|page|web)($|_)/,
  /(^|_)(list|ls|directory|dir|glob)($|_)/,
  /(^|_)find_(files?|folders?|symbols?|references?)($|_)/,
  /(^|_)(search|grep|rg|ripgrep)($|_)/,
  /(^|_)(code|source|workspace)_search($|_)/,
  /(^|_)browser_(search|fetch|read|page|open|find|screenshot|snapshot|navigate|get_text|extract_text)($|_)/,
  /(^|_)web_(search|fetch|read|page|open|get|extract)($|_)/,
  /(^|_)page_(read|fetch|open|get|snapshot|screenshot)($|_)/,
  /(^|_)(internet|online)_(search|query|lookup|research)($|_)/,
  /(^|_)(search|query|lookup|research)_(web|internet|online)($|_)/,
  /(^|_)(image|news)_(search|query)($|_)/,
  /(^|_)fetch_(url|page|web)($|_)/,
  /(^|_)(http|https)_get($|_)/,
  /(^|_)get_(url|page|web|website|http|https)($|_)/,
  /(^|_)read_(url|page|web|website)($|_)/,
  /(^|_)url_(read|fetch|open)($|_)/,
] as const;

export function classifyExploreRuntimeTool(
  toolName: string,
  args?: unknown,
): ExploreGuardrailDecision {
  const normalizedToolName = normalizeRuntimeToolName(toolName);
  if (!normalizedToolName) return block(normalizedToolName, "empty runtime tool name");

  if (EXPLORE_SHELL_TOOL_PATTERN.test(normalizedToolName)) {
    const invocation = extractExploreShellInvocation(args);
    if (!invocation) {
      return pending(
        normalizedToolName,
        "shell tool start did not include command text yet",
        summarizeArgShape(args),
      );
    }
    return withToolName(normalizedToolName, classifyExploreShellInvocation(invocation));
  }

  if (EXPLORE_READ_ONLY_WEB_REQUEST_TOOL_NAMES.has(normalizedToolName)) {
    const detail = explainExploreMutatingWebRequestArgs(normalizedToolName, args);
    return detail
      ? block(
          normalizedToolName,
          "web request includes mutating method, body, upload, or output",
          detail,
        )
      : allow(normalizedToolName, "read-only web request tool");
  }

  if (normalizedToolName === "browser_action") {
    return classifyExploreBrowserAction(normalizedToolName, args);
  }

  if (EXPLORE_MCP_TOOL_NAMES.has(normalizedToolName)) {
    return classifyExploreMcpTool(normalizedToolName, args);
  }

  if (EXPLORE_READ_ONLY_TOOL_NAMES.has(normalizedToolName)) {
    return allow(normalizedToolName, "known read-only runtime tool");
  }

  if (EXPLORE_BLOCKED_TOOL_PATTERNS.some((pattern) => pattern.test(normalizedToolName))) {
    return block(normalizedToolName, "tool name matches a mutating runtime category");
  }

  if (!EXPLORE_READ_ONLY_TOOL_PATTERNS.some((pattern) => pattern.test(normalizedToolName))) {
    return block(normalizedToolName, "tool name is not recognized as read-only inspection");
  }

  const detail = explainExploreMutatingWebRequestArgs(normalizedToolName, args);
  return detail
    ? block(normalizedToolName, "tool arguments include mutating request fields", detail)
    : allow(normalizedToolName, "tool name matches read-only inspection pattern");
}

export function classifyExploreShellCommand(command: string): ExploreGuardrailDecision {
  return withToolName("shell_command", classifyExploreShellInvocation({ kind: "script", command }));
}

export function formatExploreRuntimeBlockMessage(
  toolName: string,
  decision: ExploreGuardrailDecision,
): string {
  const safeToolName = toolName.trim() || "runtime tool";
  const reason = decision.reason ? ` (${decision.reason})` : "";
  const detail = decision.detail ? ` Detail: ${decision.detail}` : "";
  return `Explore mode allows read-only inspection, but blocked runtime tool "${safeToolName}"${reason}.${detail} Use read-only tools, stdout, or /dev/null; switch to Code to write files, run mutating commands, or change workspace state.`;
}

export function normalizeRuntimeToolName(toolName: string): string {
  return toolName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function withToolName(
  normalizedToolName: string,
  decision: ExploreGuardrailDecision,
): ExploreGuardrailDecision {
  return { ...decision, normalizedToolName };
}

function allow(
  normalizedToolName: string,
  reason: string,
  detail?: string,
): ExploreGuardrailDecision {
  return { status: "allow", normalizedToolName, reason, detail };
}

function block(
  normalizedToolName: string,
  reason: string,
  detail?: string,
): ExploreGuardrailDecision {
  return { status: "block", normalizedToolName, reason, detail };
}

function pending(
  normalizedToolName: string,
  reason: string,
  detail?: string,
): ExploreGuardrailDecision {
  return { status: "pending", normalizedToolName, reason, detail };
}

function classifyExploreBrowserAction(
  normalizedToolName: string,
  args?: unknown,
): ExploreGuardrailDecision {
  const action = extractExploreStringArg(args, "action");
  if (!action) {
    return pending(
      normalizedToolName,
      "browser action start did not include action text yet",
      summarizeArgShape(args),
    );
  }

  const normalizedAction = normalizeRuntimeToolName(action);
  if (EXPLORE_BROWSER_MUTATING_ACTIONS.has(normalizedAction)) {
    return block(normalizedToolName, `browser action "${normalizedAction}" is not read-only`);
  }
  if (EXPLORE_BROWSER_NAVIGATION_ACTIONS.has(normalizedAction)) {
    const detail = explainExploreMutatingWebRequestArgs(normalizedToolName, args);
    return detail
      ? block(normalizedToolName, "browser navigation includes mutating request fields", detail)
      : allow(normalizedToolName, "read-only browser navigation action");
  }
  if (EXPLORE_BROWSER_INSPECTION_ACTIONS.has(normalizedAction)) {
    const detail = explainExploreBrowserOutputTargetArgs(args);
    return detail
      ? block(normalizedToolName, "browser inspection action includes file output target", detail)
      : allow(normalizedToolName, "read-only browser inspection action");
  }

  return block(normalizedToolName, `browser action "${normalizedAction}" is not allowlisted`);
}

function classifyExploreMcpTool(
  normalizedToolName: string,
  args?: unknown,
): ExploreGuardrailDecision {
  const nestedToolName = extractExploreStringArg(args, "tool_name");
  if (!nestedToolName) {
    return pending(
      normalizedToolName,
      "MCP tool start did not include nested tool name yet",
      summarizeArgShape(args),
    );
  }

  const nestedDecision = classifyExploreRuntimeTool(nestedToolName, args);
  if (nestedDecision.normalizedToolName === normalizedToolName) {
    return block(normalizedToolName, "MCP nested tool name recurses");
  }
  if (nestedDecision.status === "allow") {
    return allow(
      normalizedToolName,
      `MCP nested tool "${nestedDecision.normalizedToolName}" is read-only`,
      nestedDecision.detail,
    );
  }
  if (nestedDecision.status === "pending") {
    return pending(
      normalizedToolName,
      `MCP nested tool "${nestedDecision.normalizedToolName}" is pending`,
      nestedDecision.detail,
    );
  }
  return block(
    normalizedToolName,
    `MCP nested tool "${nestedDecision.normalizedToolName}" is not read-only: ${nestedDecision.reason}`,
    nestedDecision.detail,
  );
}

function explainExploreBrowserOutputTargetArgs(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const stack: unknown[] = [args];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const key = normalizeRuntimeToolName(rawKey);
      if (
        key &&
        /(^|_)(file|files|output|output_path|outfile|path|save_to|target_path)($|_)/.test(key) &&
        hasExploreMeaningfulArgValue(rawValue)
      ) {
        return `argument "${rawKey}" targets ${summarizeExploreArgValue(rawValue)}`;
      }
      if (rawValue && typeof rawValue === "object") stack.push(rawValue);
    }
  }
  return null;
}

function explainExploreMutatingWebRequestArgs(toolName: string, args?: unknown): string | null {
  if (!args) return null;
  const webLikeTool =
    /(^|_)(browser|fetch|get|http|https|internet|online|request|url|web)($|_)/.test(toolName);

  const stack: unknown[] = [args];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const key = normalizeRuntimeToolName(rawKey);
      if (key && /(^|_)(method|request_method|http_method)($|_)/.test(key)) {
        if (typeof rawValue === "string" && /^(post|put|patch|delete)$/i.test(rawValue.trim())) {
          return `argument "${rawKey}" uses ${rawValue.trim().toUpperCase()}`;
        }
      }
      if (
        key &&
        /(^|_)(body|payload|form|form_data|formdata|file|files|upload|uploads|output|output_path|outfile|save_to|target_path)($|_)/.test(
          key,
        ) &&
        hasExploreMeaningfulArgValue(rawValue)
      ) {
        return `argument "${rawKey}" is set`;
      }
      if (
        webLikeTool &&
        key &&
        /(^|_)(data|data_raw|data_binary|post_data)($|_)/.test(key) &&
        hasExploreMeaningfulArgValue(rawValue)
      ) {
        return `argument "${rawKey}" is set`;
      }
      if (rawValue && typeof rawValue === "object") stack.push(rawValue);
    }
  }

  return null;
}

function hasExploreMeaningfulArgValue(value: unknown): boolean {
  if (value === null || typeof value === "undefined") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function extractExploreStringArg(args: unknown, targetKey: string): string | null {
  if (!args || typeof args !== "object") return null;
  const normalizedTargetKey = normalizeRuntimeToolName(targetKey);
  const stack: unknown[] = [args];
  while (stack.length > 0) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const key = normalizeRuntimeToolName(rawKey);
      if (key === normalizedTargetKey && typeof rawValue === "string" && rawValue.trim()) {
        return rawValue.trim();
      }
      if (rawValue && typeof rawValue === "object") stack.push(rawValue);
    }
  }
  return null;
}

function summarizeExploreArgValue(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return "an empty string";
    return normalized.length > 80 ? `"${normalized.slice(0, 77)}..."` : `"${normalized}"`;
  }
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === "object") return "object";
  return String(value);
}

function extractExploreShellInvocation(args?: unknown): ShellInvocation | null {
  if (!args) return null;
  if (typeof args === "string") return { kind: "script", command: args };
  if (isStringArray(args)) return { kind: "argv", argv: args };
  if (typeof args !== "object") return null;

  const record = args as Record<string, unknown>;
  const commandValue = extractExploreShellCommandValue(record);
  const argvValue = record["args"] ?? record["argv"];
  if (typeof commandValue === "string" && isStringArray(argvValue)) {
    const wrappedCommand = extractExploreShellArgvWrapperCommand(commandValue, argvValue);
    if (wrappedCommand) return { kind: "script", command: wrappedCommand };
    return { kind: "argv", argv: [commandValue, ...argvValue] };
  }
  if (typeof commandValue === "string") return { kind: "script", command: commandValue };
  if (isStringArray(commandValue)) return { kind: "argv", argv: commandValue };

  for (const key of EXPLORE_SHELL_COMMAND_ARG_KEYS) {
    const value = extractExploreShellInvocation(record[key]);
    if (value) return value;
  }
  for (const key of EXPLORE_NESTED_ARG_KEYS) {
    const value = extractExploreShellInvocation(record[key]);
    if (value) return value;
  }
  return null;
}

function extractExploreShellCommandValue(
  record: Record<string, unknown>,
): string | readonly string[] | null {
  for (const key of EXPLORE_SHELL_COMMAND_ARG_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (isStringArray(value) && value.length > 0) return value;
  }
  return null;
}

function extractExploreShellArgvWrapperCommand(
  command: string,
  argv: readonly string[],
): string | null {
  if (!EXPLORE_SHELL_TOOL_PATTERN.test(normalizeRuntimeToolName(command))) return null;
  const commandIndex = argv.findIndex((arg) => /^-[A-Za-z]*c[A-Za-z]*$/.test(arg));
  if (commandIndex < 0 || commandIndex + 1 >= argv.length) return null;
  return argv.slice(commandIndex + 1).join(" ");
}

function classifyExploreShellInvocation(invocation: ShellInvocation): ExploreGuardrailDecision {
  const decision = classifyReadOnlyShellInvocation(invocation);
  return { ...decision, normalizedToolName: "shell_command" };
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function summarizeArgShape(args: unknown): string | undefined {
  if (args === null) return "args=null";
  if (typeof args === "undefined") return "args=undefined";
  if (Array.isArray(args)) return `args=array(${args.length})`;
  if (typeof args === "object") return `args.keys=${Object.keys(args).join(",") || "none"}`;
  return `args=${typeof args}`;
}

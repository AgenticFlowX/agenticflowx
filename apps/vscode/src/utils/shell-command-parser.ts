/**
 * Shell parsing helpers used by Explore-mode read-only command policy.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
 */

export const SHELL_WRAPPER_PATTERN = /^(?:bash|zsh|sh|powershell|pwsh|terminal)$/;

export interface ShellSyntaxOptions {
  allowedVariables?: readonly string[];
}

export interface ParsedShellForLoop {
  variableName: string;
  iterableExpression: string;
  iterableTokens: readonly string[];
  bodySegments: readonly string[];
  postSegments: readonly string[];
}

export interface ShellCommandSubstitutions {
  sanitizedCommand: string;
  commands: readonly string[];
}

export function normalizeShellCommand(command: string): string {
  return command.replace(/\\\r?\n/g, " ").trim();
}

export function stripHarmlessShellRedirects(command: string): string {
  return command
    .replace(/(^|\s)2\s*>\s*\/dev\/null(?=\s|$|[;&|])/g, " ")
    .replace(/(^|\s)2>&1(?=\s|$|[;&|])/g, " ")
    .trim();
}

export function extractShellWrapperCommand(command: string): string | null {
  const tokens = tokenizeShellCommand(command);
  if (!tokens || tokens.length < 3) return null;
  return extractShellWrapperCommandFromArgv(tokens);
}

export function extractShellWrapperCommandFromArgv(argv: readonly string[]): string | null {
  const commandName = shellCommandName(argv[0] ?? "");
  if (!commandName || !SHELL_WRAPPER_PATTERN.test(commandName)) return null;

  const commandIndex = argv.findIndex(
    (token, index) => index > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(token),
  );
  if (commandIndex < 0 || commandIndex + 1 >= argv.length) return null;
  return argv.slice(commandIndex + 1).join(" ");
}

export function hasForbiddenShellSyntax(
  command: string,
  options: ShellSyntaxOptions = {},
): boolean {
  const allowedVariables = new Set(options.allowedVariables ?? []);
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    if (quote) {
      if (quote === '"' && char === "\\") {
        const next = command.charAt(index + 1);
        if (next === "$" || next === "`" || next === '"' || next === "\\") {
          index += 1;
          continue;
        }
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && char === "$") {
        const variableEnd = shellVariableEndIndex(command, index, allowedVariables);
        if (variableEnd > index) {
          index = variableEnd - 1;
          continue;
        }
        return true;
      }
      if (quote === '"' && char === "`") return true;
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "'") {
      quote = "'";
      index += 1;
      continue;
    }
    if (char === "$") {
      const variableEnd = shellVariableEndIndex(command, index, allowedVariables);
      if (variableEnd > index) {
        index = variableEnd - 1;
        continue;
      }
      return true;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "\\" && ["(", ")", ";"].includes(command.charAt(index + 1))) {
      index += 1;
      continue;
    }
    if (char === "{" && command.charAt(index + 1) === "}") {
      index += 1;
      continue;
    }
    if (/[<>`$(){}]/.test(char)) return true;
  }

  return false;
}

export function extractShellCommandSubstitutions(
  command: string,
): ShellCommandSubstitutions | null {
  const commands: string[] = [];
  let sanitizedCommand = "";
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    if (quote) {
      if (quote === '"' && char === "\\") {
        const next = command.charAt(index + 1);
        sanitizedCommand += char;
        if (next) {
          sanitizedCommand += next;
          index += 1;
        }
        continue;
      }
      if (char === quote) quote = null;
      if (quote !== "'" && char === "$" && command.charAt(index + 1) === "(") {
        const substitution = readCommandSubstitution(command, index);
        if (!substitution) return null;
        commands.push(substitution.command);
        sanitizedCommand += "__afx_command_substitution__";
        index = substitution.endIndex;
        continue;
      }
      sanitizedCommand += char;
      continue;
    }

    if (char === "$" && command.charAt(index + 1) === "'") {
      quote = "'";
      sanitizedCommand += "$'";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      sanitizedCommand += char;
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "(") {
      const substitution = readCommandSubstitution(command, index);
      if (!substitution) return null;
      commands.push(substitution.command);
      sanitizedCommand += "__afx_command_substitution__";
      index = substitution.endIndex;
      continue;
    }
    sanitizedCommand += char;
  }

  if (quote || commands.length === 0) return null;
  return { sanitizedCommand, commands };
}

export function parseSimpleShellForLoop(command: string): ParsedShellForLoop | null {
  const segments = splitShellCommandSegments(command);
  if (!segments || segments.length < 3) return null;

  const header = segments[0] ?? "";
  const headerMatch = header.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)$/s);
  if (!headerMatch) return null;

  const variableName = headerMatch[1] ?? "";
  const iterableExpression = (headerMatch[2] ?? "").trim();
  if (!iterableExpression) return null;

  const doneIndex = segments.findIndex((segment, index) => index > 1 && segment.trim() === "done");
  if (doneIndex < 0) return null;

  const firstBodySegment = segments[1]?.trim() ?? "";
  if (firstBodySegment !== "do" && !firstBodySegment.startsWith("do ")) return null;

  const iterableTokens = tokenizeShellCommand(iterableExpression) ?? [iterableExpression];
  const bodySegments = normalizeForLoopBodySegments(segments.slice(1, doneIndex));
  const postSegments = segments.slice(doneIndex + 1);
  if (bodySegments.length === 0) return null;
  if (bodySegments.some((segment) => /\b(?:for|while|until|case|done|esac)\b/.test(segment))) {
    return null;
  }

  return { variableName, iterableExpression, iterableTokens, bodySegments, postSegments };
}

function readCommandSubstitution(
  command: string,
  dollarIndex: number,
): { command: string; endIndex: number } | null {
  if (command.charAt(dollarIndex + 2) === "(") return null;

  let depth = 1;
  let quote: "'" | '"' | null = null;
  let inner = "";

  for (let index = dollarIndex + 2; index < command.length; index += 1) {
    const char = command.charAt(index);
    if (quote) {
      if (quote === '"' && char === "\\") {
        const next = command.charAt(index + 1);
        inner += char;
        if (next) {
          inner += next;
          index += 1;
        }
        continue;
      }
      if (char === quote) quote = null;
      inner += char;
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "'") {
      quote = "'";
      inner += "$'";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      inner += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      inner += char;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return { command: inner.trim(), endIndex: index };
      inner += char;
      continue;
    }
    inner += char;
  }

  return null;
}

function normalizeForLoopBodySegments(segments: readonly string[]): string[] {
  const normalized: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]?.trim() ?? "";
    if (!segment) continue;
    if (index === 0) {
      if (segment === "do") continue;
      if (segment.startsWith("do ")) {
        normalized.push(segment.slice(3).trim());
        continue;
      }
    }
    normalized.push(segment);
  }

  return normalized.filter(Boolean);
}

function shellVariableEndIndex(
  command: string,
  dollarIndex: number,
  allowedVariables: ReadonlySet<string>,
): number {
  const next = command.charAt(dollarIndex + 1);
  if (next === "(" || next === "`" || next === "<" || next === ">" || next === "[") return -1;
  if (/^[0-9#?]$/.test(next)) return dollarIndex + 2;

  if (next === "{") {
    const match = command.slice(dollarIndex).match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}/);
    const variableName = match?.[1];
    return variableName && isAllowedShellVariable(variableName, allowedVariables)
      ? dollarIndex + (match[0]?.length ?? 0)
      : -1;
  }

  const match = command.slice(dollarIndex).match(/^\$([A-Za-z_][A-Za-z0-9_]*)/);
  const variableName = match?.[1];
  return variableName && isAllowedShellVariable(variableName, allowedVariables)
    ? dollarIndex + (match[0]?.length ?? 0)
    : -1;
}

function isAllowedShellVariable(
  variableName: string,
  allowedVariables: ReadonlySet<string>,
): boolean {
  return (
    allowedVariables.has(variableName) ||
    ["HOME", "LOGNAME", "OLDPWD", "PWD", "SHELL", "TMPDIR", "USER"].includes(variableName)
  );
}

export function splitShellCommandSegments(command: string): string[] | null {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let commandSubstitutionDepth = 0;

  const pushSegment = (): boolean => {
    const segment = current.trim();
    current = "";
    if (!segment) return false;
    segments.push(segment);
    return true;
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    if (quote) {
      if (quote === '"' && char === "\\") {
        current += char;
        const next = command.charAt(index + 1);
        if (next) {
          current += next;
          index += 1;
        }
        continue;
      }
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "'") {
      quote = "'";
      current += "$'";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (commandSubstitutionDepth > 0) {
      if (char === "$" && command.charAt(index + 1) === "(") {
        commandSubstitutionDepth += 1;
        current += "$(";
        index += 1;
        continue;
      }
      if (char === ")") {
        commandSubstitutionDepth -= 1;
        current += char;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "(" && command.charAt(index + 2) !== "(") {
      commandSubstitutionDepth = 1;
      current += "$(";
      index += 1;
      continue;
    }
    if (char === "\\" && command.charAt(index + 1) === ";") {
      current += "\\;";
      index += 1;
      continue;
    }
    if (char === "\n" || char === ";" || char === "|") {
      if (!pushSegment()) return null;
      if (char === "|" && command.charAt(index + 1) === "|") index += 1;
      continue;
    }
    if (char === "&") {
      if (command.charAt(index + 1) !== "&") return null;
      if (!pushSegment()) return null;
      index += 1;
      continue;
    }
    current += char;
  }

  if (quote || commandSubstitutionDepth > 0 || !pushSegment()) return null;
  return segments;
}

export function tokenizeShellCommand(command: string): string[] | null {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  const pushToken = (): void => {
    if (!current) return;
    tokens.push(current);
    current = "";
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    if (quote) {
      if (quote === '"' && char === "\\") {
        const next = command.charAt(index + 1);
        if (next) {
          current += next;
          index += 1;
          continue;
        }
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      pushToken();
      continue;
    }
    if (char === "$" && command.charAt(index + 1) === "'") {
      quote = "'";
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "\\" && command.charAt(index + 1)) {
      current += command.charAt(index + 1);
      index += 1;
      continue;
    }
    current += char;
  }

  if (quote) return null;
  pushToken();
  return tokens;
}

export function shellCommandName(segment: string): string | null {
  const trimmed = segment.trim();
  if (trimmed === "[") return "[";

  const match = trimmed.match(/^([A-Za-z0-9_./-]+)/);
  if (!match) return null;
  const raw = match[1]?.split("/").pop()?.toLowerCase() ?? "";
  return raw.length > 0 ? raw : null;
}

export function firstNonOption(args: readonly string[]): string | null {
  return firstNonOptionWithIndex(args)?.value ?? null;
}

export function firstNonOptionWithIndex(
  args: readonly string[],
): { value: string; index: number } | null {
  const optionValueFlags = new Set([
    "-C",
    "-R",
    "-c",
    "-w",
    "--cwd",
    "--filter",
    "--git-dir",
    "--hostname",
    "--namespace",
    "--prefix",
    "--registry",
    "--repo",
    "--repository",
    "--work-tree",
    "--workspace",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--") {
      const next = args[index + 1];
      return next ? { value: next.toLowerCase(), index: index + 1 } : null;
    }
    if (optionValueFlags.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) continue;
    if (/^-[A-Za-z]+$/.test(arg)) continue;
    return { value: arg.toLowerCase(), index };
  }
  return null;
}

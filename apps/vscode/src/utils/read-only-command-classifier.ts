/**
 * Classifies shell commands that are safe enough for Explore-mode read-only inspection.
 *
 * @see docs/specs/201-app-vscode-panels/spec.md [FR-11]
 * @see docs/specs/201-app-vscode-panels/design.md [DES-PANELS-MODE-WORKFLOW]
 */
import {
  SHELL_WRAPPER_PATTERN,
  extractShellCommandSubstitutions,
  extractShellWrapperCommand,
  extractShellWrapperCommandFromArgv,
  firstNonOption,
  firstNonOptionWithIndex,
  hasForbiddenShellSyntax,
  normalizeShellCommand,
  parseSimpleShellForLoop,
  shellCommandName,
  splitShellCommandSegments,
  stripHarmlessShellRedirects,
  tokenizeShellCommand,
} from "./shell-command-parser";

export { tokenizeShellCommand } from "./shell-command-parser";

export type ReadOnlyCommandStatus = "allow" | "block";

export interface ReadOnlyCommandDecision {
  status: ReadOnlyCommandStatus;
  reason: string;
  detail?: string;
}

export type ShellInvocation =
  | { kind: "script"; command: string }
  | { kind: "argv"; argv: readonly string[] };

interface CommandSubstitutionDecision {
  command: string;
  decision: ReadOnlyCommandDecision;
}

interface ShellClassificationContext {
  allowedVariables?: readonly string[];
}

interface ShellAssignmentDecision {
  variableName?: string;
  decision: ReadOnlyCommandDecision;
}

type CommandFamilyClassifier = (
  commandName: string,
  argv: readonly string[],
) => ReadOnlyCommandDecision | null;

const MAX_SHELL_SEGMENTS = 24;

const SIMPLE_READ_ONLY_COMMANDS = new Set([
  "awk",
  "basename",
  "cat",
  "cd",
  "column",
  "cut",
  "date",
  "df",
  "dirname",
  "du",
  "echo",
  "fd",
  "file",
  "groups",
  "grep",
  "head",
  "hostname",
  "id",
  "jq",
  "ls",
  "paste",
  "printf",
  "pwd",
  "readlink",
  "realpath",
  "rg",
  "ripgrep",
  "sed",
  "sort",
  "stat",
  "tail",
  "tree",
  "tr",
  "true",
  "type",
  "uname",
  "uniq",
  "uptime",
  "wc",
  "whereis",
  "which",
  "whoami",
  "yq",
]);

const WEB_READ_COMMANDS = new Set(["curl", "wget"]);
const PYTHON_COMMANDS = new Set(["python", "python3"]);
const JAVASCRIPT_COMMANDS = new Set(["node", "nodejs"]);
const PACKAGE_MANAGER_COMMANDS = new Set(["bun", "npm", "pnpm", "yarn"]);

const COMMAND_FAMILY_CLASSIFIERS: readonly CommandFamilyClassifier[] = [
  classifyPythonCommand,
  classifyJavaScriptCommand,
  classifyWebReadCommand,
  classifyFindCommand,
  classifyXargsCommand,
  classifyTestCommand,
  classifyCommandBuiltin,
  classifyCommandWrapper,
  classifyGitCommand,
  classifyGitHubCliCommand,
  classifyPackageManagerCommand,
];

export function classifyReadOnlyShellInvocation(
  invocation: ShellInvocation,
): ReadOnlyCommandDecision {
  return invocation.kind === "argv"
    ? classifyReadOnlyShellArgv(invocation.argv)
    : classifyReadOnlyShellCommand(invocation.command);
}

export function classifyReadOnlyShellCommand(command: string): ReadOnlyCommandDecision {
  return classifyReadOnlyShellCommandInternal(command);
}

function classifyReadOnlyShellCommandInternal(
  command: string,
  context: ShellClassificationContext = {},
): ReadOnlyCommandDecision {
  const trimmed = stripHarmlessShellRedirects(normalizeShellCommand(command));
  if (!trimmed) return block("empty shell command");
  if (trimmed.length > 2_000) return block("shell command exceeds length limit");

  const wrappedCommand = extractShellWrapperCommand(trimmed);
  if (wrappedCommand) return classifyReadOnlyShellCommandInternal(wrappedCommand, context);

  const forLoopDecision = classifySimpleForLoopCommand(trimmed);
  if (forLoopDecision) return forLoopDecision;
  if (/^\s*for\s+/i.test(trimmed)) {
    return block("shell for loop is not simple enough for read-only classification");
  }

  const substitutionDecision = classifyCommandSubstitutions(trimmed, context);
  if (substitutionDecision.decision.status === "block") return substitutionDecision.decision;
  const classifiableCommand = substitutionDecision.command;

  if (hasForbiddenShellSyntax(classifiableCommand, context)) {
    return block("shell command contains forbidden expansion or redirection syntax");
  }
  if (/\b(?:sudo|su)\b/i.test(trimmed)) {
    return block("privileged shell helpers are not read-only");
  }

  const segments = splitShellCommandSegments(classifiableCommand);
  if (!segments || segments.length === 0)
    return block("shell command has no classifiable segments");
  if (segments.length > MAX_SHELL_SEGMENTS) return block("shell pipeline is too complex");

  for (const segment of segments) {
    const argv = tokenizeShellCommand(segment);
    if (!argv) return block("shell command could not be tokenized safely", segment);
    const decision = classifyReadOnlyShellArgv(argv);
    if (decision.status === "block") return decision;
  }

  return allow("read-only shell command");
}

export function classifyReadOnlyShellArgv(argv: readonly string[]): ReadOnlyCommandDecision {
  if (argv.length === 0) return block("empty shell argv");
  const commandName = shellCommandName(argv[0] ?? "");
  if (!commandName) return block("missing shell command name");

  if (SHELL_WRAPPER_PATTERN.test(commandName)) {
    const wrappedCommand = extractShellWrapperCommandFromArgv(argv);
    return wrappedCommand
      ? classifyReadOnlyShellCommand(wrappedCommand)
      : block("shell wrapper did not include a -c command string");
  }

  for (const classifier of COMMAND_FAMILY_CLASSIFIERS) {
    const decision = classifier(commandName, argv);
    if (decision) return decision;
  }

  return classifySimpleReadOnlyCommand(commandName, argv);
}

function classifySimpleReadOnlyCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision {
  if (!SIMPLE_READ_ONLY_COMMANDS.has(commandName)) {
    return block(`shell command "${commandName}" is not read-only`);
  }
  if (commandName === "sed" && argv.some((arg) => arg === "-i" || arg === "--in-place")) {
    return block("sed in-place editing is not read-only");
  }
  if (commandName === "awk" && argv.some((arg) => /\bsystem\s*\(/i.test(arg))) {
    return block("awk system() is not read-only");
  }
  return allow("read-only shell argv");
}

function classifyPythonCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (!PYTHON_COMMANDS.has(commandName)) return null;

  const args = argv.slice(1);
  if (args.length === 0) return block("interactive python is not read-only");

  const moduleIndex = args.findIndex((arg) => arg === "-m");
  if (moduleIndex >= 0) {
    const moduleName = args[moduleIndex + 1];
    return moduleName === "json.tool"
      ? allow("read-only python json.tool formatter")
      : block(`python module "${moduleName ?? ""}" is not allowlisted`);
  }

  const commandIndex = args.findIndex((arg) => arg === "-c");
  if (commandIndex < 0 || commandIndex + 1 >= args.length) {
    return block("python scripts are not allowed in Explore mode");
  }

  return classifyPythonInlineCode(args[commandIndex + 1] ?? "");
}

function classifyPythonInlineCode(code: string): ReadOnlyCommandDecision {
  return classifyInlineCode(code, {
    language: "python",
    allowedStdoutAliases: [/\bsys\.stdout\.write\s*\(/g],
    blockedPatterns: [
      [/\b(?:exec|eval|compile|__import__)\s*\(/, "dynamic python execution is not read-only"],
      [/\b(?:subprocess|shutil|socket)\b/, "python process/file/network modules are blocked"],
      [
        /\bos\.(?:system|popen|spawn\w*|exec\w*|fork|kill)\s*\(/,
        "python process helpers are blocked",
      ],
      [
        /\bos\.(?:remove|unlink|rename|replace|rmdir|removedirs|mkdir|makedirs|chmod|chown|truncate|utime)\s*\(/,
        "python os file mutation helpers are blocked",
      ],
      [/\bos\.environ(?:\[[^\]]+\])?\s*=/, "python environment mutation is blocked"],
      [/\bos\.putenv\s*\(/, "python environment mutation is blocked"],
      [
        /\bopen\s*\([^)]*,\s*(?:mode\s*=\s*)?["'][^"']*[wax+][^"']*["']/,
        "python mutating file open modes are blocked",
      ],
      [
        /\bopen\s*\([^)]*mode\s*=\s*["'][^"']*[wax+][^"']*["']/,
        "python mutating file open modes are blocked",
      ],
      [
        /\.(?:write|writelines|write_text|write_bytes|touch|unlink|rename|replace|mkdir|rmdir|chmod|chown|truncate)\s*\(/,
        "python file mutation methods are blocked",
      ],
      [
        /\b(?:requests|httpx)\.(?:post|put|patch|delete|request)\s*\(/,
        "python mutating web request helpers are blocked",
      ],
      [
        /\burllib\.request\.request\s*\([^)]*method\s*=\s*["'](?:post|put|patch|delete)["']/s,
        "python mutating urllib request methods are blocked",
      ],
    ],
  });
}

function classifyJavaScriptCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (!JAVASCRIPT_COMMANDS.has(commandName)) return null;

  const args = argv.slice(1);
  const commandIndex = args.findIndex((arg) => arg === "-e" || arg === "--eval" || arg === "-p");
  if (commandIndex < 0 || commandIndex + 1 >= args.length) {
    return block("node scripts and REPL are not allowed in Explore mode");
  }

  return classifyInlineCode(args[commandIndex + 1] ?? "", {
    language: "javascript",
    allowedStdoutAliases: [],
    blockedPatterns: [
      [
        /\b(?:require|import)\s*\(?\s*["'](?:node:)?(?:child_process|worker_threads|cluster|net|tls|dgram)["']/,
        "node process/network modules are blocked",
      ],
      [/\b(?:exec|execfile|spawn|fork)\s*\(/, "node process spawning helpers are blocked"],
      [
        /\b(?:writefile|appendfile|mkdir|rmdir|rm|rename|copyfile|chmod|chown|unlink|truncate)(?:sync)?\s*\(/,
        "node file mutation helpers are blocked",
      ],
      [/\bcreatewritestream\s*\(/, "node file mutation helpers are blocked"],
      [
        /\bopensync\s*\([^)]*,\s*["'][^"']*[wax+][^"']*["']/,
        "node mutating file open modes are blocked",
      ],
      [
        /\bopen\s*\([^)]*,\s*["'][^"']*[wax+][^"']*["']/,
        "node mutating file open modes are blocked",
      ],
      [/\bprocess\.(?:exit|chdir|kill)\b/, "node process mutation is blocked"],
      [
        /\bfetch\s*\([^)]*\{[^)]*(?:method\s*:\s*["'](?:post|put|patch|delete)["']|body\s*:)/s,
        "node mutating fetch options are blocked",
      ],
    ],
  });
}

function classifyInlineCode(
  code: string,
  options: {
    language: string;
    allowedStdoutAliases: readonly RegExp[];
    blockedPatterns: ReadonlyArray<readonly [RegExp, string]>;
  },
): ReadOnlyCommandDecision {
  let normalized = code.trim();
  if (!normalized) return block(`empty ${options.language} command`);
  if (normalized.length > 2_000) {
    return block(`${options.language} command exceeds length limit`);
  }

  for (const alias of options.allowedStdoutAliases) {
    normalized = normalized.replace(alias, "print(");
  }

  const lower = normalized.toLowerCase();
  for (const [pattern, reason] of options.blockedPatterns) {
    if (pattern.test(lower)) return block(reason);
  }

  return allow(`read-only ${options.language} one-liner`);
}

function classifyCommandSubstitutions(
  command: string,
  context: ShellClassificationContext,
): CommandSubstitutionDecision {
  const substitutions = extractShellCommandSubstitutions(command);
  if (!substitutions) return { command, decision: allow("no command substitutions") };

  for (const nestedCommand of substitutions.commands) {
    const nestedDecision = classifyReadOnlyShellCommandInternal(nestedCommand, context);
    if (nestedDecision.status === "block") {
      return {
        command,
        decision: block(`command substitution ${nestedDecision.reason}`, nestedDecision.detail),
      };
    }
  }

  return {
    command: substitutions.sanitizedCommand,
    decision: allow("read-only command substitutions"),
  };
}

function classifySimpleForLoopCommand(command: string): ReadOnlyCommandDecision | null {
  const loop = parseSimpleShellForLoop(command);
  if (!loop) return null;

  const iterableDecision = classifyForLoopIterableExpression(loop.iterableExpression);
  if (iterableDecision.status === "block") return iterableDecision;

  const allowedVariables = new Set([loop.variableName]);
  const bodyDecision = classifyForLoopBodySegments(loop.bodySegments, allowedVariables);
  if (bodyDecision.status === "block") return bodyDecision;

  for (const segment of loop.postSegments) {
    const decision = classifyReadOnlyShellCommandInternal(segment);
    if (decision.status === "block") return block(`for loop output pipeline ${decision.reason}`);
  }

  return allow("read-only shell for loop");
}

function classifyForLoopIterableExpression(expression: string): ReadOnlyCommandDecision {
  if (expression.length > 1_000) return block("for loop iterable exceeds length limit");

  const substitutionDecision = classifyCommandSubstitutions(expression, {});
  if (substitutionDecision.decision.status === "block") {
    return block(`for loop iterable ${substitutionDecision.decision.reason}`);
  }
  const classifiableExpression = substitutionDecision.command;

  if (hasForbiddenShellSyntax(classifiableExpression)) {
    return block("for loop iterable contains forbidden shell syntax");
  }

  const tokens = tokenizeShellCommand(classifiableExpression);
  if (!tokens || tokens.length === 0) return block("for loop iterable could not be tokenized");
  return tokens.every(isReadOnlyForLoopIterableToken)
    ? allow("read-only for loop iterable")
    : block("for loop iterable contains unsafe shell syntax");
}

function classifyForLoopBodySegments(
  bodySegments: readonly string[],
  allowedVariables: Set<string>,
): ReadOnlyCommandDecision {
  for (let index = 0; index < bodySegments.length; index += 1) {
    const segment = bodySegments[index] ?? "";
    if (/^\s*if\s+/i.test(segment)) {
      const fiIndex = findSimpleIfEndIndex(bodySegments, index);
      if (fiIndex < 0) return block("for loop body simple if is incomplete");

      const decision = classifySimpleIfSegments(
        bodySegments.slice(index, fiIndex + 1),
        allowedVariables,
      );
      if (decision.status === "block") return decision;
      index = fiIndex;
      continue;
    }

    const decision = classifyForLoopBodySegment(segment, allowedVariables);
    if (decision.status === "block") return decision;
  }

  return allow("read-only for loop body");
}

function classifyForLoopBodySegment(
  segment: string,
  allowedVariables: Set<string>,
): ReadOnlyCommandDecision {
  const assignmentDecision = classifyReadOnlyAssignment(segment, {
    allowedVariables: Array.from(allowedVariables),
  });
  if (assignmentDecision) {
    if (assignmentDecision.decision.status === "block") {
      return block(`for loop body ${assignmentDecision.decision.reason}`);
    }
    if (assignmentDecision.variableName) allowedVariables.add(assignmentDecision.variableName);
    return allow("read-only for loop assignment");
  }

  const decision = classifyReadOnlyShellCommandInternal(segment, {
    allowedVariables: Array.from(allowedVariables),
  });
  return decision.status === "allow" ? decision : block(`for loop body ${decision.reason}`);
}

function findSimpleIfEndIndex(segments: readonly string[], startIndex: number): number {
  for (let index = startIndex + 1; index < segments.length; index += 1) {
    const segment = segments[index]?.trim() ?? "";
    if (/^(?:else|elif)\b/i.test(segment)) return -1;
    if (/^fi$/i.test(segment)) return index;
  }
  return -1;
}

function classifySimpleIfSegments(
  segments: readonly string[],
  allowedVariables: Set<string>,
): ReadOnlyCommandDecision {
  const condition = (segments[0] ?? "")
    .trim()
    .replace(/^if\s+/i, "")
    .trim();
  if (!condition) return block("for loop body simple if has no condition");

  const thenSegment = segments[1]?.trim() ?? "";
  if (thenSegment !== "then" && !/^then\s+/i.test(thenSegment)) {
    return block("for loop body simple if is missing then");
  }

  const conditionDecision = classifyReadOnlyShellCommandInternal(condition, {
    allowedVariables: Array.from(allowedVariables),
  });
  if (conditionDecision.status === "block") {
    return block(`for loop body if condition ${conditionDecision.reason}`);
  }

  const thenCommands = [
    ...(thenSegment === "then" ? [] : [thenSegment.replace(/^then\s+/i, "")]),
    ...segments.slice(2, -1),
  ].filter((segment) => segment.trim().length > 0);

  if (thenCommands.length === 0) return allow("read-only empty simple if");
  return classifyForLoopBodySegments(thenCommands, allowedVariables);
}

function classifyReadOnlyAssignment(
  command: string,
  context: ShellClassificationContext,
): ShellAssignmentDecision | null {
  const match = command.trim().match(/^([a-z_][a-z0-9_]*)=(.*)$/s);
  if (!match) return null;

  const variableName = match[1] ?? "";
  const rawValue = (match[2] ?? "").trim();
  const substitutionDecision = classifyCommandSubstitutions(rawValue, context);
  if (substitutionDecision.decision.status === "block") {
    return { decision: block(`assignment ${substitutionDecision.decision.reason}`) };
  }
  if (hasForbiddenShellSyntax(substitutionDecision.command, context)) {
    return { decision: block("assignment contains forbidden shell syntax") };
  }

  return { variableName, decision: allow("read-only shell assignment") };
}

function isReadOnlyForLoopIterableToken(token: string): boolean {
  return token.length > 0 && !/[;&|<>`$(){}]/.test(token);
}

function classifyWebReadCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (!WEB_READ_COMMANDS.has(commandName)) return null;

  return isReadOnlyWebArgv(commandName, argv)
    ? allow("read-only web shell argv")
    : block(`mutating or file-writing ${commandName} argv`);
}

function isReadOnlyWebArgv(commandName: string, argv: readonly string[]): boolean {
  const args = argv.slice(1);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    const lower = arg.toLowerCase();

    if (commandName === "curl") {
      if (lower === "-x" || lower === "--request") {
        const method = args[index + 1]?.toLowerCase() ?? "";
        if (/^(post|put|patch|delete)$/.test(method)) return false;
      }
      if (/^(?:-x|--request=)(post|put|patch|delete)$/i.test(arg)) return false;
      if (
        lower === "-d" ||
        lower.startsWith("--data") ||
        lower === "-t" ||
        lower === "-o" ||
        lower === "--form" ||
        lower === "--form-string" ||
        lower === "--upload-file" ||
        lower === "--output" ||
        lower === "--remote-name" ||
        lower === "--remote-name-all"
      ) {
        return false;
      }
      if (/^-[A-Za-z]*[dFToO][A-Za-z]*$/.test(arg)) return false;
    }

    if (commandName === "wget") {
      if (lower === "--post-data" || lower.startsWith("--post-data=")) return false;
      if (lower === "--post-file" || lower.startsWith("--post-file=")) return false;
    }
  }

  if (commandName !== "wget") return true;
  return args.some((arg, index) => {
    const lower = arg.toLowerCase();
    return (
      lower === "-qo-" ||
      lower === "-qO-" ||
      lower === "-o-" ||
      (lower === "-o" && args[index + 1] === "-") ||
      lower === "--output-document=-" ||
      (lower === "--output-document" && args[index + 1] === "-")
    );
  });
}

function classifyFindCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "find") return null;

  const args = argv.slice(1);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]?.toLowerCase() ?? "";
    if (arg === "-delete" || arg === "-ok" || arg === "-okdir" || arg === "-execdir") {
      return block("find delete, prompt-exec, and execdir flags are not read-only");
    }
    if (arg !== "-exec") continue;

    const commandStart = index + 1;
    const commandEnd = findExecTerminatorIndex(args, commandStart);
    if (commandEnd < 0) return block("find -exec is missing a command terminator");
    if (commandEnd === commandStart) return block("find -exec needs a nested command");

    const nestedDecision = classifyReadOnlyShellArgv(args.slice(commandStart, commandEnd));
    if (nestedDecision.status === "block") {
      return block(`find -exec ${nestedDecision.reason}`, nestedDecision.detail);
    }
    index = commandEnd;
  }

  return allow("read-only find argv");
}

function findExecTerminatorIndex(args: readonly string[], startIndex: number): number {
  for (let index = startIndex; index < args.length; index += 1) {
    if (args[index] === "+" || args[index] === ";" || args[index] === "\\;") return index;
  }
  return -1;
}

function classifyXargsCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "xargs") return null;

  const args = argv.slice(1);
  const commandStart = xargsNestedCommandStartIndex(args);
  if (commandStart < 0) return allow("read-only xargs default echo");

  const nestedDecision = classifyReadOnlyShellArgv(args.slice(commandStart));
  return nestedDecision.status === "allow"
    ? allow("read-only xargs nested command")
    : block(`xargs ${nestedDecision.reason}`, nestedDecision.detail);
}

function classifyTestCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "[" && commandName !== "test") return null;
  if (commandName === "[" && argv[argv.length - 1] !== "]") {
    return block("shell [ test is missing closing ]");
  }
  return allow("read-only shell test");
}

function xargsNestedCommandStartIndex(args: readonly string[]): number {
  const flagsWithValue = new Set([
    "-E",
    "-I",
    "-J",
    "-L",
    "-P",
    "-R",
    "-S",
    "-a",
    "-d",
    "-e",
    "-n",
    "-s",
    "--arg-file",
    "--delimiter",
    "--eof",
    "--max-args",
    "--max-chars",
    "--max-lines",
    "--max-procs",
    "--process-slot-var",
    "--replace",
  ]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (arg === "--") return index + 1 < args.length ? index + 1 : -1;
    if (flagsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--") || /^-[A-Za-z0-9]+.*$/.test(arg)) continue;
    return index;
  }

  return -1;
}

function classifyCommandBuiltin(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "command") return null;

  const args = argv.slice(1);
  if (args.length < 2) return block("command builtin needs a read-only query flag");
  const queryFlag = args[0];
  return queryFlag === "-v" || queryFlag === "-V"
    ? allow("read-only command lookup")
    : block("command builtin may execute a nested command");
}

function classifyCommandWrapper(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName === "time") return classifyTimeWrapper(argv);
  if (commandName === "timeout") return classifyTimeoutWrapper(argv);
  return null;
}

function classifyTimeWrapper(argv: readonly string[]): ReadOnlyCommandDecision {
  const args = argv.slice(1);
  const commandStart = args.findIndex((arg) => !arg.startsWith("-"));
  if (commandStart < 0) return block("time wrapper needs a nested command");

  const nestedDecision = classifyReadOnlyShellArgv(args.slice(commandStart));
  return nestedDecision.status === "allow"
    ? allow("read-only time wrapper")
    : block(`time wrapper ${nestedDecision.reason}`, nestedDecision.detail);
}

function classifyTimeoutWrapper(argv: readonly string[]): ReadOnlyCommandDecision {
  const args = argv.slice(1);
  const durationIndex = timeoutDurationIndex(args);
  if (durationIndex < 0 || durationIndex + 1 >= args.length) {
    return block("timeout wrapper needs a duration and nested command");
  }

  const nestedDecision = classifyReadOnlyShellArgv(args.slice(durationIndex + 1));
  return nestedDecision.status === "allow"
    ? allow("read-only timeout wrapper")
    : block(`timeout wrapper ${nestedDecision.reason}`, nestedDecision.detail);
}

function timeoutDurationIndex(args: readonly string[]): number {
  const flagsWithValue = new Set(["-k", "-s", "--kill-after", "--signal"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? "";
    if (flagsWithValue.has(arg)) {
      index += 1;
      continue;
    }
    if (arg.startsWith("--kill-after=") || arg.startsWith("--signal=")) continue;
    if (arg.startsWith("-")) continue;
    return index;
  }

  return -1;
}

function classifyGitCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "git") return null;

  const subcommandEntry = firstNonOptionWithIndex(argv.slice(1));
  if (!subcommandEntry) return block("git needs an explicit read-only subcommand");
  const subcommand = subcommandEntry.value;
  const subcommandArgs = argv.slice(subcommandEntry.index + 2);

  const readOnlySubcommands = new Set([
    "blame",
    "cat-file",
    "describe",
    "diff",
    "for-each-ref",
    "grep",
    "log",
    "ls-files",
    "ls-remote",
    "ls-tree",
    "merge-base",
    "rev-list",
    "rev-parse",
    "shortlog",
    "show",
    "show-branch",
    "show-ref",
    "status",
  ]);
  if (readOnlySubcommands.has(subcommand)) return allow(`read-only git ${subcommand}`);

  if (subcommand === "config") {
    return argv.some((arg) => ["--get", "--get-all", "--list", "-l"].includes(arg))
      ? allow("read-only git config")
      : block("git config without read flags may write configuration");
  }

  if (subcommand === "branch") {
    const hasListFlag = subcommandArgs.some((arg) => arg === "--list" || arg === "-l");
    const onlyListingFlags = subcommandArgs.every(
      (arg) => arg.startsWith("-") && !/^-[dDmMcfC]/.test(arg),
    );
    return hasListFlag || onlyListingFlags
      ? allow("read-only git branch listing")
      : block("git branch arguments may create, move, or delete refs");
  }

  if (subcommand === "remote") {
    const remoteSubcommand = firstNonOption(subcommandArgs);
    return !remoteSubcommand || ["get-url", "show", "v"].includes(remoteSubcommand)
      ? allow("read-only git remote")
      : block("git remote subcommand may mutate remotes");
  }

  if (subcommand === "stash") {
    const stashSubcommand = firstNonOption(subcommandArgs);
    return !stashSubcommand || ["list", "show"].includes(stashSubcommand)
      ? allow("read-only git stash")
      : block("git stash subcommand may mutate workspace state");
  }

  if (subcommand === "tag") {
    return subcommandArgs.length === 0 ||
      subcommandArgs.some((arg) => ["-l", "--list", "--contains"].includes(arg))
      ? allow("read-only git tag listing")
      : block("git tag arguments may create or delete tags");
  }

  return block(`git ${subcommand} is not read-only`);
}

function classifyGitHubCliCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (commandName !== "gh") return null;

  const groupEntry = firstNonOptionWithIndex(argv.slice(1));
  if (!groupEntry) return block("gh needs an explicit read-only command");
  const group = groupEntry.value;
  const groupArgs = argv.slice(groupEntry.index + 2);

  if (group === "api") {
    return isReadOnlyGhApiArgv(argv)
      ? allow("read-only gh api")
      : block("gh api request may mutate");
  }

  const action = firstNonOption(groupArgs);
  const allowedActionsByGroup: Record<string, readonly string[]> = {
    auth: ["status"],
    issue: ["list", "status", "view"],
    pr: ["checks", "diff", "list", "status", "view"],
    release: ["list", "view"],
    repo: ["list", "view"],
    run: ["list", "view"],
    search: ["code", "commits", "issues", "prs", "repos"],
    workflow: ["list", "view"],
  };

  const allowedActions = allowedActionsByGroup[group];
  if (!allowedActions) return block(`gh ${group} is not read-only`);
  if (!action && allowedActions.includes("list")) return allow(`read-only gh ${group}`);
  return action && allowedActions.includes(action)
    ? allow(`read-only gh ${group} ${action}`)
    : block(`gh ${group}${action ? ` ${action}` : ""} is not read-only`);
}

function isReadOnlyGhApiArgv(argv: readonly string[]): boolean {
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]?.toLowerCase() ?? "";
    if (arg === "--method" || arg === "-x") {
      const method = args[index + 1]?.toLowerCase() ?? "";
      if (method && !["get", "head"].includes(method)) return false;
    }
    if (/^(?:--method=|-x)(post|put|patch|delete)$/i.test(arg)) return false;
    if (
      arg === "--field" ||
      arg === "-f" ||
      arg === "--raw-field" ||
      arg === "-F" ||
      arg === "--input"
    ) {
      return false;
    }
  }
  return true;
}

function classifyPackageManagerCommand(
  commandName: string,
  argv: readonly string[],
): ReadOnlyCommandDecision | null {
  if (!PACKAGE_MANAGER_COMMANDS.has(commandName)) return null;

  const args = argv.slice(1);
  const subcommandEntry = firstNonOptionWithIndex(args);
  if (!subcommandEntry) return block(`${commandName} needs an explicit read-only subcommand`);
  const subcommand = subcommandEntry.value;
  const subcommandArgs = args.slice(subcommandEntry.index + 1);

  const mutatingSubcommands = new Set([
    "add",
    "audit",
    "build",
    "ci",
    "dedupe",
    "dlx",
    "exec",
    "format",
    "init",
    "install",
    "lint",
    "link",
    "publish",
    "rebuild",
    "remove",
    "run",
    "start",
    "test",
    "unlink",
    "update",
    "upgrade",
  ]);
  if (mutatingSubcommands.has(subcommand)) {
    return block(`${commandName} ${subcommand} may mutate workspace or runtime state`);
  }

  if (subcommand === "config") {
    return args.some((arg) => arg === "get" || arg === "list" || arg === "-l")
      ? allow(`read-only ${commandName} config`)
      : block(`${commandName} config without read flags may mutate configuration`);
  }

  const readOnlyByManager: Record<string, readonly string[]> = {
    bun: ["info", "outdated", "pm"],
    npm: ["explain", "info", "list", "ls", "outdated", "root", "search", "view", "why"],
    pnpm: ["info", "licenses", "list", "ls", "outdated", "root", "search", "view", "why"],
    yarn: ["info", "list", "npm", "outdated", "why"],
  };

  if (commandName === "bun" && subcommand === "pm") {
    const nested = firstNonOption(subcommandArgs);
    return nested && ["ls", "why"].includes(nested)
      ? allow("read-only bun pm")
      : block("bun pm subcommand is not read-only");
  }

  if (commandName === "yarn" && subcommand === "npm") {
    const nested = firstNonOption(subcommandArgs);
    return nested && ["info", "tag"].includes(nested)
      ? allow("read-only yarn npm metadata")
      : block("yarn npm subcommand is not read-only");
  }

  return readOnlyByManager[commandName]?.includes(subcommand)
    ? allow(`read-only ${commandName} ${subcommand}`)
    : block(`${commandName} ${subcommand} is not read-only`);
}

function allow(reason: string, detail?: string): ReadOnlyCommandDecision {
  return { status: "allow", reason, detail };
}

function block(reason: string, detail?: string): ReadOnlyCommandDecision {
  return { status: "block", reason, detail };
}

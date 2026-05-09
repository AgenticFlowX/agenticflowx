/**
 * Verified AFX command catalog for composer menus and post-message actions.
 *
 * Static commands rendered by the chat UI must come from this catalog unless
 * they are explicitly listed as draft-only compatibility aliases. The entries
 * mirror the bundled AgenticFlowX skill `Usage` blocks as of this extension
 * bundle.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */

export type AfxCommandFamily =
  | "afx-spec"
  | "afx-design"
  | "afx-task"
  | "afx-check"
  | "afx-context"
  | "afx-session"
  | "afx-adr"
  | "afx-research"
  | "afx-next"
  | "afx-sprint";

export type AfxCommandGroup = "quality" | "state" | "action" | "memory" | "research" | "global";

export type SupportedAfxCommand = Readonly<{
  family: AfxCommandFamily;
  subcommand: string | null;
  command: string;
  label: string;
  autoSend: boolean;
  group: AfxCommandGroup;
  usage: string;
}>;

export type DraftOnlyAfxAlias = Readonly<{
  family: AfxCommandFamily;
  subcommand: string;
  command: string;
  label: string;
  autoSend: false;
  draftOnlyAlias: true;
  reason: string;
}>;

export type AfxCommandClassification =
  | Readonly<{
      kind: "supported";
      entry: SupportedAfxCommand;
      autoSend: boolean;
    }>
  | Readonly<{
      kind: "draft-only-alias";
      entry: DraftOnlyAfxAlias;
      autoSend: false;
    }>
  | Readonly<{
      kind: "unknown";
      autoSend: false;
      family: string | null;
      subcommand: string | null;
    }>;

type CommandSeed = Omit<SupportedAfxCommand, "family" | "command">;

function command(family: AfxCommandFamily, seed: CommandSeed): SupportedAfxCommand {
  const suffix = seed.subcommand ? ` ${seed.subcommand}` : "";
  return Object.freeze({
    ...seed,
    family,
    command: `/${family}${suffix}`,
  });
}

function alias(
  family: AfxCommandFamily,
  subcommand: string,
  label: string,
  reason: string,
): DraftOnlyAfxAlias {
  return Object.freeze({
    family,
    subcommand,
    command: `/${family} ${subcommand}`,
    label,
    autoSend: false,
    draftOnlyAlias: true,
    reason,
  });
}

function freezeFamily(
  family: AfxCommandFamily,
  entries: CommandSeed[],
): readonly SupportedAfxCommand[] {
  return Object.freeze(entries.map((entry) => command(family, entry)));
}

export const AFX_COMMAND_CATALOG = Object.freeze({
  "afx-spec": freezeFamily("afx-spec", [
    {
      subcommand: "create",
      label: "Create",
      autoSend: false,
      group: "action",
      usage: "/afx-spec create <name>",
    },
    {
      subcommand: "validate",
      label: "Validate",
      autoSend: true,
      group: "quality",
      usage: "/afx-spec validate <name>",
    },
    {
      subcommand: "refine",
      label: "Refine",
      autoSend: false,
      group: "quality",
      usage: "/afx-spec refine <name>",
    },
    {
      subcommand: "discuss",
      label: "Discuss",
      autoSend: false,
      group: "action",
      usage: "/afx-spec discuss <name>",
    },
    {
      subcommand: "review",
      label: "Review",
      autoSend: true,
      group: "quality",
      usage: "/afx-spec review <name>",
    },
    {
      subcommand: "approve",
      label: "Approve",
      autoSend: true,
      group: "state",
      usage: '/afx-spec approve <name> [--reviewer "@handle"]',
    },
  ]),
  "afx-design": freezeFamily("afx-design", [
    {
      subcommand: "author",
      label: "Author",
      autoSend: false,
      group: "action",
      usage: "/afx-design author <name>",
    },
    {
      subcommand: "refine",
      label: "Refine",
      autoSend: false,
      group: "quality",
      usage: "/afx-design refine <name>",
    },
    {
      subcommand: "validate",
      label: "Validate",
      autoSend: true,
      group: "quality",
      usage: "/afx-design validate <name>",
    },
    {
      subcommand: "review",
      label: "Review",
      autoSend: true,
      group: "quality",
      usage: "/afx-design review <name>",
    },
    {
      subcommand: "approve",
      label: "Approve",
      autoSend: true,
      group: "state",
      usage: "/afx-design approve <name>",
    },
  ]),
  "afx-task": freezeFamily("afx-task", [
    {
      subcommand: "plan",
      label: "Plan",
      autoSend: false,
      group: "action",
      usage: "/afx-task plan <name>",
    },
    {
      subcommand: "refine",
      label: "Refine",
      autoSend: false,
      group: "quality",
      usage: "/afx-task refine <name>",
    },
    {
      subcommand: "pick",
      label: "Pick",
      autoSend: true,
      group: "state",
      usage: "/afx-task pick <id>",
    },
    {
      subcommand: "complete",
      label: "Complete",
      autoSend: false,
      group: "state",
      usage: "/afx-task complete <id>",
    },
    {
      subcommand: "code",
      label: "Code",
      autoSend: false,
      group: "action",
      usage: "/afx-task code <id>|all <name>",
    },
    {
      subcommand: "verify",
      label: "Verify",
      autoSend: true,
      group: "quality",
      usage: "/afx-task verify <task-id>|all <name>",
    },
    {
      subcommand: "brief",
      label: "Brief",
      autoSend: true,
      group: "action",
      usage: "/afx-task brief <task-id>",
    },
    {
      subcommand: "review",
      label: "Review",
      autoSend: true,
      group: "quality",
      usage: "/afx-task review <name>",
    },
    {
      subcommand: "validate",
      label: "Validate",
      autoSend: true,
      group: "quality",
      usage: "/afx-task validate <name>",
    },
    {
      subcommand: "status",
      label: "Status",
      autoSend: true,
      group: "state",
      usage: "/afx-task status <name>",
    },
    {
      subcommand: "sync",
      label: "Sync",
      autoSend: false,
      group: "action",
      usage: "/afx-task sync [spec] [issue]",
    },
  ]),
  "afx-check": freezeFamily("afx-check", [
    {
      subcommand: "path",
      label: "Path",
      autoSend: true,
      group: "quality",
      usage: "/afx-check path <feature-path>",
    },
    {
      subcommand: "trace",
      label: "Trace",
      autoSend: true,
      group: "quality",
      usage: "/afx-check trace [path]",
    },
    {
      subcommand: "links",
      label: "Links",
      autoSend: true,
      group: "quality",
      usage: "/afx-check links <spec-path>",
    },
    {
      subcommand: "schema",
      label: "Schema",
      autoSend: true,
      group: "quality",
      usage: "/afx-check schema <spec-path>",
    },
    {
      subcommand: "deps",
      label: "Deps",
      autoSend: true,
      group: "quality",
      usage: "/afx-check deps [feature]",
    },
    {
      subcommand: "coverage",
      label: "Coverage",
      autoSend: true,
      group: "quality",
      usage: "/afx-check coverage <spec-path>",
    },
    {
      subcommand: "all",
      label: "All",
      autoSend: true,
      group: "quality",
      usage: "/afx-check all <feature-path>",
    },
  ]),
  "afx-context": freezeFamily("afx-context", [
    {
      subcommand: "save",
      label: "Save",
      autoSend: false,
      group: "memory",
      usage: "/afx-context save [feature]",
    },
    {
      subcommand: "load",
      label: "Load",
      autoSend: true,
      group: "memory",
      usage: "/afx-context load",
    },
    {
      subcommand: "history",
      label: "History",
      autoSend: true,
      group: "memory",
      usage: "/afx-context history [feature]",
    },
    {
      subcommand: "impact",
      label: "Impact",
      autoSend: false,
      group: "memory",
      usage: "/afx-context impact <change>",
    },
  ]),
  "afx-session": freezeFamily("afx-session", [
    {
      subcommand: "note",
      label: "Note",
      autoSend: false,
      group: "memory",
      usage: '/afx-session note "content" [tags] [--ref id]',
    },
    {
      subcommand: "log",
      label: "Log",
      autoSend: false,
      group: "memory",
      usage: "/afx-session log [feature]",
    },
    {
      subcommand: "recap",
      label: "Recap",
      autoSend: true,
      group: "memory",
      usage: "/afx-session recap [feature|all]",
    },
    {
      subcommand: "promote",
      label: "Promote",
      autoSend: false,
      group: "memory",
      usage: "/afx-session promote <id>",
    },
    {
      subcommand: "capture",
      label: "Capture",
      autoSend: false,
      group: "memory",
      usage:
        "/afx-session capture [feature] [--trigger <kind>] [--links <anchors>] [--agent <name>] [--model <id>] [...context]",
    },
  ]),
  "afx-adr": freezeFamily("afx-adr", [
    {
      subcommand: "create",
      label: "Create",
      autoSend: false,
      group: "action",
      usage: "/afx-adr create <title>",
    },
    {
      subcommand: "review",
      label: "Review",
      autoSend: false,
      group: "quality",
      usage: "/afx-adr review <id>",
    },
    {
      subcommand: "accept",
      label: "Accept",
      autoSend: false,
      group: "state",
      usage: "/afx-adr accept <id>",
    },
    {
      subcommand: "list",
      label: "List",
      autoSend: true,
      group: "state",
      usage: "/afx-adr list",
    },
    {
      subcommand: "supersede",
      label: "Supersede",
      autoSend: false,
      group: "state",
      usage: "/afx-adr supersede <id> <new-id>",
    },
  ]),
  "afx-research": freezeFamily("afx-research", [
    {
      subcommand: "explore",
      label: "Explore",
      autoSend: false,
      group: "research",
      usage: "/afx-research explore <topic-or-prompt>",
    },
    {
      subcommand: "compare",
      label: "Compare",
      autoSend: false,
      group: "research",
      usage: "/afx-research compare <topic-or-prompt>",
    },
    {
      subcommand: "summarize",
      label: "Summarize",
      autoSend: false,
      group: "research",
      usage: "/afx-research summarize <topic-or-prompt>",
    },
    {
      subcommand: "finalize",
      label: "Finalize",
      autoSend: false,
      group: "research",
      usage: "/afx-research finalize <topic-or-prompt> --to adr|spec [--feature <name>]",
    },
  ]),
  "afx-next": freezeFamily("afx-next", [
    {
      subcommand: null,
      label: "Next",
      autoSend: true,
      group: "global",
      usage: "/afx-next",
    },
  ]),
  "afx-sprint": freezeFamily("afx-sprint", [
    {
      subcommand: "new",
      label: "New",
      autoSend: false,
      group: "action",
      usage: "/afx-sprint new <feature> [...context]",
    },
    {
      subcommand: "refine",
      label: "Refine",
      autoSend: false,
      group: "quality",
      usage: "/afx-sprint refine [feature] [spec|design|task] [...context]",
    },
    {
      subcommand: "spec",
      label: "Refine Spec",
      autoSend: false,
      group: "action",
      usage: "/afx-sprint spec [feature] [...context]",
    },
    {
      subcommand: "design",
      label: "Refine Design",
      autoSend: false,
      group: "action",
      usage: "/afx-sprint design [feature] [...context]",
    },
    {
      subcommand: "task",
      label: "Refine Tasks",
      autoSend: false,
      group: "action",
      usage: "/afx-sprint task [feature] [...context]",
    },
    {
      subcommand: "code",
      label: "Code",
      autoSend: false,
      group: "action",
      usage: "/afx-sprint code [feature] [task-id] [...context]",
    },
    {
      subcommand: "verify",
      label: "Verify",
      autoSend: true,
      group: "quality",
      usage: "/afx-sprint verify [feature] [...context]",
    },
    {
      subcommand: "graduate",
      label: "Graduate",
      autoSend: false,
      group: "state",
      usage: "/afx-sprint graduate [feature] [...context]",
    },
  ]),
} satisfies Record<AfxCommandFamily, readonly SupportedAfxCommand[]>);

export const DRAFT_ONLY_AFX_ALIASES = Object.freeze([
  alias(
    "afx-session",
    "active",
    "Active",
    "Undocumented session-listing alias; use supported session commands.",
  ),
]);

const SUPPORTED_BY_KEY = new Map<string, SupportedAfxCommand>(
  Object.values(AFX_COMMAND_CATALOG)
    .flat()
    .map((entry) => [commandKey(entry.family, entry.subcommand), entry]),
);

const DRAFT_ALIAS_BY_KEY = new Map<string, DraftOnlyAfxAlias>(
  DRAFT_ONLY_AFX_ALIASES.map((entry) => [commandKey(entry.family, entry.subcommand), entry]),
);

function commandKey(family: string, subcommand: string | null): string {
  return `${family}:${subcommand ?? ""}`;
}

export function findSupportedAfxCommand(
  family: AfxCommandFamily,
  subcommand: string | null,
): SupportedAfxCommand | null {
  return SUPPORTED_BY_KEY.get(commandKey(family, subcommand)) ?? null;
}

export function classifyAfxCommand(commandText: string): AfxCommandClassification {
  const parsed = parseAfxCommand(commandText);
  if (!parsed) {
    return { kind: "unknown", autoSend: false, family: null, subcommand: null };
  }

  const supported = SUPPORTED_BY_KEY.get(commandKey(parsed.family, parsed.subcommand));
  if (supported) {
    return { kind: "supported", entry: supported, autoSend: supported.autoSend };
  }

  const aliasEntry = DRAFT_ALIAS_BY_KEY.get(commandKey(parsed.family, parsed.subcommand));
  if (aliasEntry) {
    return { kind: "draft-only-alias", entry: aliasEntry, autoSend: false };
  }

  return {
    kind: "unknown",
    autoSend: false,
    family: parsed.family,
    subcommand: parsed.subcommand,
  };
}

function parseAfxCommand(
  commandText: string,
): { family: string; subcommand: string | null } | null {
  const match = commandText.trim().match(/^\/(afx-[a-z]+)(?:\s+([a-z][a-z-]*))?(?:\s|$)/i);
  if (!match) {
    return null;
  }

  return {
    family: match[1].toLowerCase(),
    subcommand: match[2]?.toLowerCase() ?? null,
  };
}

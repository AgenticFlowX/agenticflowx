/**
 * Doc-action routing for the Spec mode composer strip and welcome card.
 *
 * Maps an active AFX document (sprint single-file or standard 4-file plus
 * journal/ADR/research/context) to a 3-action SDD intent set. Pure function —
 * no React, no transport, easy to unit-test.
 *
 * @see docs/specs/100-package-shared/spec.md [FR-12]
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
import type { FocusOption, PhaseRow, SignOffSummary } from "@afx/shared";

import { type AfxCommandFamily, findSupportedAfxCommand } from "./command-catalog";

export type ActiveDocCtx = {
  format: "sprint" | "standard" | null;
  section: "SPEC" | "DESIGN" | "TASKS" | null;
  docKind: "spec" | "design" | "tasks" | "journal" | "adr" | "research" | "context" | null;
  feature: string | null;
  filePath?: string | null;
  approvalStatus: string | null;
  taskPhases?: PhaseRow[];
  signOff?: SignOffSummary;
  parsedFocuses?: FocusOption[];
  specStatus?: string | null;
  designStatus?: string | null;
  tasksStatus?: string | null;
  tasksCompleted?: number;
  tasksTotal?: number;
  /**
   * Counts for the `## Work Sessions` table — `signed/total` rows. Powers the
   * spec stepper's tier-2 Work Sessions chip label.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  workSessionsTotal?: number;
  workSessionsSigned?: number;
  /**
   * Absolute paths to sibling SDD files for the current feature (standard
   * 4-file mode only). Powers the spec stepper's per-step click-to-open;
   * missing entries render the corresponding pill as disabled.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  siblingPaths?: {
    spec?: string;
    design?: string;
    tasks?: string;
    journal?: string;
  };
  /**
   * 1-indexed in-file section heading lines — sprint files populate spec/
   * design/tasks/sessions; standard tasks.md populates `sessions` only.
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-17]
   */
  sectionOffsets?: {
    spec?: number;
    design?: number;
    tasks?: number;
    sessions?: number;
  };
};

export const EMPTY_DOC_CTX: ActiveDocCtx = {
  format: null,
  section: null,
  docKind: null,
  feature: null,
  filePath: null,
  approvalStatus: null,
};

export type DocAction = {
  label: string;
  command: string;
  /**
   * When true, clicking the button fires `chat/send` (or `chat/followUp` while
   * streaming) immediately. When false, the command is inserted into the
   * composer draft so the user can refine before sending. Auto-send is
   * reserved for deterministic verbs that don't need user-supplied content
   * (validate, approve, verify, pick, list, load, history, recap).
   *
   * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
   */
  autoSend: boolean;
};

export type MemoryCatalogItem = DocAction & {
  id: string;
  description: string;
  workflowDetail: string;
  usage: string;
};

export type MemoryCatalogGroup = {
  id: "session-memory" | "discussion";
  label: "SESSION MEMORY" | "DISCUSSION";
  items: readonly MemoryCatalogItem[];
};

function memoryItem(
  id: string,
  family: AfxCommandFamily,
  subcommand: string,
  description: string,
  workflowDetail: string,
): MemoryCatalogItem {
  const entry = findSupportedAfxCommand(family, subcommand);
  if (!entry) {
    throw new Error(`Missing supported AFX memory command: /${family} ${subcommand}`);
  }

  return {
    id,
    label: entry.label,
    command: entry.command,
    autoSend: entry.autoSend,
    description,
    workflowDetail,
    usage: entry.usage,
  };
}

/**
 * Shared Memory menu catalog for every composer anchor. Deterministic reads
 * auto-send; mutating commands and commands with open arguments stay draft-first.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export const MEMORY_CATALOG = Object.freeze([
  {
    id: "session-memory",
    label: "SESSION MEMORY",
    items: [
      memoryItem(
        "context-save",
        "afx-context",
        "save",
        "Draft a context handoff",
        "Generate a detailed .afx/context.md bundle so a future agent or human can resume with decisions, blockers, changed files, and next steps intact.",
      ),
      memoryItem(
        "context-load",
        "afx-context",
        "load",
        "Load the saved context",
        "Read the active .afx/context.md bundle back into the chat without compressing it, then re-orient with the recommended next workflow step.",
      ),
      memoryItem(
        "context-history",
        "afx-context",
        "history",
        "Show context history",
        "Build a spec evolution timeline from git history so you can see what changed, when, and which workflow to resume from.",
      ),
      memoryItem(
        "context-impact",
        "afx-context",
        "impact",
        "Draft an impact query",
        "Analyze how a proposed change could affect specs, cross-references, and traced code before updating the living documents.",
      ),
    ],
  },
  {
    id: "discussion",
    label: "DISCUSSION",
    items: [
      memoryItem(
        "session-note",
        "afx-session",
        "note",
        "Draft a session note",
        "Capture a quick idea, tip, or follow-up in journal.md; the workflow can infer tags or append to an existing discussion.",
      ),
      memoryItem(
        "session-log",
        "afx-session",
        "log",
        "Draft a session log entry",
        "Summarize the current discussion into a permanent journal discussion with context, summary, decisions, and progress.",
      ),
      memoryItem(
        "session-recap",
        "afx-session",
        "recap",
        "Recap recent discussion",
        "Synthesize recent journal discussions for resumption, including key decisions, open items, and where to continue.",
      ),
      memoryItem(
        "session-promote",
        "afx-session",
        "promote",
        "Draft a promotion target",
        "Promote an important discussion into an ADR or a new feature spec when it becomes durable product or architecture truth.",
      ),
      memoryItem(
        "session-capture",
        "afx-session",
        "capture",
        "Draft a capture request",
        "Preserve a pivotal user prompt plus a focused agent-reply excerpt, linked to the artifact change it produced.",
      ),
    ],
  },
] satisfies readonly MemoryCatalogGroup[]);

/**
 * Resolve up to 3 SDD intent actions for the active AFX doc. Sprint-section
 * docs route through `/afx-sprint`; standard 4-file specs route through their
 * canonical command family (`/afx-spec`, `/afx-design`, `/afx-task`). Other
 * AFX file types (journal, ADR, research, context) route to their own
 * command families.
 *
 * @see docs/specs/211-app-chat-composer/spec.md [FR-15]
 */
export function resolveDocActions(docContext: ActiveDocCtx): DocAction[] {
  const isSprint = docContext.format === "sprint";
  const featureArg = docContext.feature ? ` ${docContext.feature}` : "";

  switch (docContext.docKind) {
    case "spec":
      // Standard 4-file spec.md exposes the full Refine→Author→Validate→Review→Approve
      // pipeline. Sprint sections collapse Validate+Review into a single
      // `verify` subcommand while Author advances to the next sprint section.
      return isSprint
        ? [
            {
              label: "Refine",
              command: `/afx-sprint spec${featureArg}`,
              autoSend: false,
            },
            {
              label: "Author",
              command: `/afx-sprint design${featureArg}`,
              autoSend: false,
            },
            {
              label: "Verify",
              command: `/afx-sprint verify${featureArg}`,
              autoSend: true,
            },
            {
              label: "Approve",
              command: `/afx-sprint spec${featureArg} --approve`,
              autoSend: true,
            },
          ]
        : [
            { label: "Refine", command: `/afx-spec refine${featureArg}`, autoSend: false },
            { label: "Author", command: `/afx-design author${featureArg}`, autoSend: false },
            { label: "Validate", command: `/afx-spec validate${featureArg}`, autoSend: true },
            { label: "Review", command: `/afx-spec review${featureArg}`, autoSend: true },
            { label: "Approve", command: `/afx-spec approve${featureArg}`, autoSend: true },
          ];
    case "design":
      return isSprint
        ? [
            {
              label: "Refine",
              command: `/afx-sprint design${featureArg}`,
              autoSend: false,
            },
            {
              label: "Author",
              command: `/afx-sprint task${featureArg}`,
              autoSend: false,
            },
            {
              label: "Verify",
              command: `/afx-sprint verify${featureArg}`,
              autoSend: true,
            },
            {
              label: "Approve",
              command: `/afx-sprint design${featureArg} --approve`,
              autoSend: true,
            },
          ]
        : [
            { label: "Refine", command: `/afx-design refine${featureArg}`, autoSend: false },
            { label: "Author", command: `/afx-task plan${featureArg}`, autoSend: false },
            { label: "Validate", command: `/afx-design validate${featureArg}`, autoSend: true },
            { label: "Review", command: `/afx-design review${featureArg}`, autoSend: true },
            { label: "Approve", command: `/afx-design approve${featureArg}`, autoSend: true },
          ];
    case "tasks":
      // Sprint tasks use /afx-sprint lifecycle verbs; standard tasks use
      // /afx-task and avoid passing a feature slug where a task id is expected.
      if (isSprint) {
        return [
          { label: "Refine", command: `/afx-sprint task${featureArg}`, autoSend: false },
          { label: "Code", command: `/afx-sprint code${featureArg}`, autoSend: false },
          { label: "Verify", command: `/afx-sprint verify${featureArg}`, autoSend: true },
          {
            label: "Approve",
            command: `/afx-sprint task${featureArg} --approve`,
            autoSend: true,
          },
          { label: "Graduate", command: `/afx-sprint graduate${featureArg}`, autoSend: false },
        ];
      }
      return [
        {
          label: "Code",
          command: `/afx-task code all${featureArg}`,
          autoSend: false,
        },
        {
          label: "Verify",
          command: `/afx-task verify all${featureArg}`,
          autoSend: true,
        },
        { label: "Pick", command: `/afx-task pick`, autoSend: true },
        { label: "Review", command: `/afx-task review${featureArg}`, autoSend: true },
        { label: "Status", command: `/afx-task status${featureArg}`, autoSend: true },
      ];
    case "journal":
      // Note/Log/Promote/Capture write or need user-authored context, so they
      // stay draft-first. Recap is a deterministic read/synthesis.
      return [
        { label: "Note", command: `/afx-session note${featureArg}`, autoSend: false },
        { label: "Log", command: `/afx-session log${featureArg}`, autoSend: false },
        { label: "Recap", command: `/afx-session recap${featureArg}`, autoSend: true },
        { label: "Promote", command: `/afx-session promote${featureArg}`, autoSend: false },
        { label: "Capture", command: `/afx-session capture${featureArg}`, autoSend: false },
      ];
    case "adr":
      // Review + Supersede stay draft because we don't currently plumb the ADR
      // filename into the bridge payload — without an ID, the agent can't act.
      // List takes no args and runs deterministically.
      return [
        { label: "Review", command: `/afx-adr review${featureArg}`, autoSend: false },
        { label: "Supersede", command: `/afx-adr supersede${featureArg}`, autoSend: false },
        { label: "List", command: `/afx-adr list${featureArg}`, autoSend: true },
      ];
    case "research":
      // Research is inherently dialogic — every verb takes a topic. Subcommand
      // names here mirror the canonical /afx-research API (`explore`,
      // `compare`, `summarize`, `finalize`).
      return [
        { label: "Explore", command: `/afx-research explore${featureArg}`, autoSend: false },
        { label: "Compare", command: `/afx-research compare${featureArg}`, autoSend: false },
        {
          label: "Summarize",
          command: `/afx-research summarize${featureArg}`,
          autoSend: false,
        },
        { label: "Finalize", command: `/afx-research finalize${featureArg}`, autoSend: false },
      ];
    case "context":
      // `.afx/context.md` is the canonical agent-handoff bundle. Load and
      // History are deterministic reads. Save writes a handoff bundle, and
      // Impact needs a free-text change spec, so both stay draft-first here.
      return [
        { label: "Load", command: `/afx-context load`, autoSend: true },
        { label: "Save", command: `/afx-context save${featureArg}`, autoSend: false },
        { label: "History", command: `/afx-context history${featureArg}`, autoSend: true },
        { label: "Impact", command: `/afx-context impact`, autoSend: false },
      ];
    case null:
    default:
      return [];
  }
}

/**
 * Friendly label for the active AFX doc — used as the strip title and in the
 * mode-suggest hint.
 *
 * @see docs/specs/211-app-chat-composer/design.md [DES-COMPOSER-COMPONENT-STRIP]
 */
export function describeDoc(docContext: ActiveDocCtx): string {
  switch (docContext.docKind) {
    case "spec":
      return "spec.md";
    case "design":
      return "design.md";
    case "tasks":
      return "tasks.md";
    case "journal":
      return "journal.md";
    case "adr":
      return "ADR";
    case "research":
      return "research note";
    case "context":
      return ".afx/context.md";
    case null:
    default:
      return docContext.format === "sprint" ? `${docContext.feature ?? "sprint"}.md` : "AFX doc";
  }
}

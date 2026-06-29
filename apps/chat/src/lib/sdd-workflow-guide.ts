/**
 * Derive timeline SDD guide cards from assistant edit tools.
 *
 * @see docs/specs/212-app-chat-messages/spec.md [FR-1] [FR-6]
 * @see docs/specs/212-app-chat-messages/design.md [DES-MESSAGES-COMPONENTS]
 */
import {
  type ChatMessageView,
  classifySddDocumentPath,
  sddJournalActionForPath,
  sddPrimaryActionForPath,
} from "@afx/shared";

import { deriveModifiedFiles } from "./derive-modified-files";
import type { ParsedResultAction } from "./result-actions";

export interface SddGuideFile {
  path: string;
  label: string;
  kind: string;
  status: "running" | "ok" | "error";
  primary: boolean;
  line?: number;
}

export interface SddGuideAction {
  label: string;
  command: string;
  mode: "insert" | "send";
}

export interface SddWorkflowGuide {
  id: string;
  feature: string;
  eventLabel: string;
  currentStep: "spec" | "design" | "tasks" | "research" | "journal";
  files: SddGuideFile[];
  recommended: SddGuideAction | null;
  alternatives: SddGuideAction[];
  previewPath: string;
}

const STEP_PRIORITY = ["spec", "sprint", "design", "tasks", "journal", "research", "adr"] as const;

export function deriveSddWorkflowGuide(
  message: ChatMessageView,
  resultActions: readonly ParsedResultAction[],
): SddWorkflowGuide | null {
  if (message.streaming) return null;

  const { files } = deriveModifiedFiles([message]);
  const sddFiles = files
    .map((file) => {
      const info = classifySddDocumentPath(file.path);
      if (!info) return null;
      return {
        path: info.path,
        label: info.label,
        kind: info.kind,
        status: file.status,
        primary: false,
        line: file.line,
        feature: info.feature,
        rank: rankForKind(info.kind),
      };
    })
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .sort((a, b) => normalizedRank(a.rank) - normalizedRank(b.rank));

  if (sddFiles.length === 0) return null;

  const primary = pickPrimaryFile(sddFiles, resultActions);
  const orderedFiles = sddFiles
    .slice()
    .sort((a, b) => (a.path === primary.path ? -1 : b.path === primary.path ? 1 : 0));
  const guideFiles: SddGuideFile[] = orderedFiles.map((file) => ({
    path: file.path,
    label: file.label,
    kind: file.kind,
    status: file.status,
    primary: file.path === primary.path,
    line: file.line,
  }));
  const feature = primary.feature ?? featureFromPath(primary.path);
  const primaryAction = sddPrimaryActionForPath(primary.path);
  const journalAction = sddJournalActionForPath(primary.path);
  const nextStepAction = nextStepActionForKind(primary.kind, feature);
  const preferredResultAction = resultActions.find(
    (action) => action.status !== "unknown" && actionMatchesKind(action, primary.kind),
  );
  const resultAlternatives = resultActions
    .filter((action) => action.status !== "unknown")
    .map(toGuideAction);

  // Same-document follow-ups: refine, journal, and any agent-surfaced actions.
  const followUps = dedupeActions([
    ...(preferredResultAction ? [toGuideAction(preferredResultAction)] : []),
    ...(primaryAction ? [primaryAction] : []),
    ...(journalAction ? [journalAction] : []),
    ...resultAlternatives,
  ]);

  // Phase-aware: recommend advancing to the next lifecycle step (spec → design →
  // tasks); fall back to the best same-document action when there is no forward step.
  const recommended = nextStepAction ?? followUps[0] ?? null;
  const alternatives = followUps.filter((action) => action.command !== recommended?.command);

  return {
    id: `sdd-guide-${message.id}`,
    feature,
    eventLabel: eventLabelForFiles(guideFiles),
    currentStep: stepForKind(primary.kind),
    files: guideFiles,
    recommended,
    alternatives,
    previewPath: primary.path,
  };
}

function normalizedRank(rank: number): number {
  return rank < 0 ? Number.MAX_SAFE_INTEGER : rank;
}

function rankForKind(kind: string): number {
  return STEP_PRIORITY.findIndex((step) => step === kind);
}

function pickPrimaryFile<
  T extends {
    kind: string;
    rank: number;
  },
>(files: readonly T[], resultActions: readonly ParsedResultAction[]): T {
  for (const action of resultActions) {
    const match = files.find((file) => actionMatchesKind(action, file.kind));
    if (match) return match;
  }
  return files[0];
}

function actionMatchesKind(action: ParsedResultAction, kind: string): boolean {
  if (action.family == null) return false;
  switch (action.family) {
    case "afx-spec":
      return kind === "spec";
    case "afx-design":
      return kind === "design";
    case "afx-task":
    case "afx-check":
      return kind === "tasks";
    case "afx-session":
      return kind === "journal";
    case "afx-research":
      return kind === "research";
    case "afx-adr":
      return kind === "adr";
    case "afx-sprint":
      return kind === "sprint";
    default:
      return false;
  }
}

function toGuideAction(action: ParsedResultAction): SddGuideAction {
  return {
    label: action.label,
    command: action.command,
    mode: action.autoSend ? "send" : "insert",
  };
}

/**
 * The next lifecycle step after editing a document of the given kind, so the
 * guide points forward (spec → design → tasks) instead of back at the document
 * just written. Returns null for kinds with no canonical forward step.
 */
function nextStepActionForKind(kind: string, feature: string): SddGuideAction | null {
  switch (kind) {
    case "spec":
      return { label: "Author design", command: `/afx-design author ${feature}`, mode: "insert" };
    case "design":
      return { label: "Plan tasks", command: `/afx-task plan ${feature}`, mode: "insert" };
    case "tasks":
      return {
        label: "Start implementation",
        command: `/afx-task code ${feature}`,
        mode: "insert",
      };
    default:
      return null;
  }
}

function stepForKind(kind: string): SddWorkflowGuide["currentStep"] {
  if (kind === "design") return "design";
  if (kind === "tasks") return "tasks";
  if (kind === "journal") return "journal";
  if (kind === "research" || kind === "adr") return "research";
  return "spec";
}

function eventLabelForFiles(files: readonly SddGuideFile[]): string {
  const hasRunning = files.some((file) => file.status === "running");
  const hasError = files.some((file) => file.status === "error");
  if (hasRunning) return "SDD updating";
  if (hasError) return "SDD needs attention";
  return files.length === 1 ? "SDD document changed" : "SDD documents changed";
}

function featureFromPath(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? (parts[parts.length - 2] ?? path) : path;
}

function dedupeActions(actions: readonly SddGuideAction[]): SddGuideAction[] {
  const seen = new Set<string>();
  const out: SddGuideAction[] = [];
  for (const action of actions) {
    const key = action.command.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}
